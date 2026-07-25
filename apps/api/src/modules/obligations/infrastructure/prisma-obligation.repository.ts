import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service'
import { ObligationInstance, ObligationPayment } from '../domain/obligation.entity'
import {
  CreateObligationInstanceInput,
  ObligationExpectedTotal,
  ObligationPaidTotal,
  ObligationRepository,
} from '../domain/obligation.repository'

/**
 * Payments always travel with their transaction: the amount, currency and date
 * of a payment live on the transaction that settled it, so the mapper needs
 * them to build the domain entity.
 */
const paymentsWithTransaction = {
  payments: {
    include: { transaction: true },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.ObligationInstanceInclude

type PrismaInstanceWithPayments = Prisma.ObligationInstanceGetPayload<{
  include: typeof paymentsWithTransaction
}>

type PrismaPaymentWithTransaction = Prisma.ObligationPaymentGetPayload<{
  include: { transaction: true }
}>

/**
 * Prisma adapter for the ObligationRepository port. This is the only unit that
 * knows about Prisma for the obligations aggregate; swapping ORMs means adding
 * a sibling adapter and rebinding the port in ObligationsModule.
 */
@Injectable()
export class PrismaObligationRepository extends ObligationRepository {
  constructor(private readonly prisma: PrismaService) {
    super()
  }

  async createInstance(
    input: CreateObligationInstanceInput,
  ): Promise<ObligationInstance> {
    const instance = await this.prisma.obligationInstance.create({
      data: input,
      include: paymentsWithTransaction,
    })

    return toInstance(instance)
  }

  async createGeneratedInstance(
    input: CreateObligationInstanceInput & { recurringRuleId: string },
  ): Promise<ObligationInstance | null> {
    try {
      const instance = await this.prisma.obligationInstance.create({
        data: input,
        include: paymentsWithTransaction,
      })

      return toInstance(instance)
    } catch (error) {
      // A concurrent generation for the same (rule, period) landed first and
      // hit the unique index. Signal "already generated" with null — the same
      // convention PrismaRecurringTransactionRepository uses — rather than
      // letting the raw Prisma error surface as an unhandled 500.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return null
      }

      throw error
    }
  }

  async findInstanceByIdForTenant(
    id: string,
    tenantId: string,
  ): Promise<ObligationInstance | null> {
    const instance = await this.prisma.obligationInstance.findFirst({
      where: { id, tenantId },
      include: paymentsWithTransaction,
    })

    return instance ? toInstance(instance) : null
  }

  async listInstancesByPeriod(
    tenantId: string,
    period: string,
  ): Promise<ObligationInstance[]> {
    const instances = await this.prisma.obligationInstance.findMany({
      where: { tenantId, period },
      include: paymentsWithTransaction,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
    })

    return instances.map(toInstance)
  }

  async listGeneratedRuleIdsForPeriod(
    tenantId: string,
    period: string,
  ): Promise<string[]> {
    const rows = await this.prisma.obligationInstance.findMany({
      where: { tenantId, period, recurringRuleId: { not: null } },
      select: { recurringRuleId: true },
    })

    return rows
      .map((row) => row.recurringRuleId)
      .filter((ruleId): ruleId is string => ruleId !== null)
  }

  async createPayment(input: {
    tenantId: string
    obligationInstanceId: string
    transactionId: string
  }): Promise<ObligationPayment | null> {
    try {
      const payment = await this.prisma.obligationPayment.create({
        data: input,
        include: { transaction: true },
      })

      return toPayment(payment)
    } catch (error) {
      // The global unique index on transaction_id rejected the link: a
      // concurrent caller reconciled this transaction first. Signal it with
      // null so the service can report a conflict instead of a 500.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return null
      }

      throw error
    }
  }

  async findPaymentByTransactionId(
    tenantId: string,
    transactionId: string,
  ): Promise<ObligationPayment | null> {
    const payment = await this.prisma.obligationPayment.findFirst({
      where: { tenantId, transactionId },
      include: { transaction: true },
    })

    return payment ? toPayment(payment) : null
  }

  async deletePayment(
    tenantId: string,
    obligationInstanceId: string,
    transactionId: string,
  ): Promise<boolean> {
    // deleteMany (not delete) so the tenant scope is part of the WHERE clause:
    // a cross-tenant id matches zero rows instead of unlinking someone else's
    // payment.
    const result = await this.prisma.obligationPayment.deleteMany({
      where: { tenantId, obligationInstanceId, transactionId },
    })

    return result.count > 0
  }

  async sumExpectedByCurrency(
    tenantId: string,
    period: string,
  ): Promise<ObligationExpectedTotal[]> {
    const rows = await this.prisma.obligationInstance.groupBy({
      by: ['currency'],
      where: { tenantId, period },
      _sum: { expectedAmountMinor: true },
    })

    return rows.map((row) => ({
      currency: row.currency,
      expectedMinor: row._sum.expectedAmountMinor ?? 0,
    }))
  }

  /**
   * Sums the transactions linked to the period's obligations, grouped by the
   * transaction's own currency. Aggregation happens in SQL by walking the
   * payment relation, so no instance or transaction is ever loaded into
   * application memory to be added up.
   */
  async sumPaidByCurrency(
    tenantId: string,
    period: string,
  ): Promise<ObligationPaidTotal[]> {
    const rows = await this.prisma.transaction.groupBy({
      by: ['currency'],
      where: {
        tenantId,
        obligationPayment: {
          is: { tenantId, obligationInstance: { is: { tenantId, period } } },
        },
      },
      _sum: { amountMinor: true },
    })

    return rows.map((row) => ({
      currency: row.currency,
      paidMinor: row._sum.amountMinor ?? 0,
    }))
  }
}

function toInstance(instance: PrismaInstanceWithPayments): ObligationInstance {
  return {
    id: instance.id,
    tenantId: instance.tenantId,
    sourceType: instance.sourceType,
    recurringRuleId: instance.recurringRuleId,
    period: instance.period,
    dueDate: instance.dueDate,
    name: instance.name,
    expectedAmountMinor: instance.expectedAmountMinor,
    currency: instance.currency,
    createdAt: instance.createdAt,
    updatedAt: instance.updatedAt,
    payments: instance.payments.map(toPayment),
  }
}

function toPayment(payment: PrismaPaymentWithTransaction): ObligationPayment {
  return {
    id: payment.id,
    tenantId: payment.tenantId,
    obligationInstanceId: payment.obligationInstanceId,
    transactionId: payment.transactionId,
    // Amount, currency and date belong to the transaction that settled the
    // obligation; the payment row is only the link.
    amountMinor: payment.transaction.amountMinor,
    currency: payment.transaction.currency,
    occurredAt: payment.transaction.occurredAt,
    createdAt: payment.createdAt,
  }
}
