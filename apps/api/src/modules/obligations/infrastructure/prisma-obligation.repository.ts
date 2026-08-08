import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service'
import { ObligationInstance, ObligationPayment } from '../domain/obligation.entity'
import {
  CreateObligationInstanceInput,
  ObligationCurrencyTotalRow,
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

  /**
   * The one aggregate in this codebase that cannot be expressed with Prisma's
   * query builder, and the reason it uses $queryRaw.
   *
   * The outstanding total has to be the SUM of each obligation's own shortfall
   * — GREATEST(expected - paid, 0) per instance, then summed — because the
   * difference between the totals silently absorbs overpayments: 230k/250k
   * next to 100k/0 still leaves 100k owed, while subtracting totals reports
   * 80k. That needs payments grouped per instance BEFORE the currency
   * grouping, which `groupBy` cannot nest.
   *
   * Aggregation still happens entirely in Postgres; nothing is summed in
   * application memory. Values are parameterized, never interpolated.
   */
  async summarizeByCurrency(
    tenantId: string,
    period: string,
  ): Promise<ObligationCurrencyTotalRow[]> {
    const rows = await this.prisma.$queryRaw<RawSummaryRow[]>`
      SELECT
        i."currency" AS currency,
        SUM(i."expected_amount_minor") AS expected_minor,
        SUM(COALESCE(p.paid, 0)) AS paid_minor,
        SUM(GREATEST(i."expected_amount_minor" - COALESCE(p.paid, 0), 0)) AS outstanding_minor
      FROM "obligation_instances" i
      LEFT JOIN (
        SELECT op."obligation_instance_id" AS instance_id, SUM(t."amount_minor") AS paid
        FROM "obligation_payments" op
        JOIN "transactions" t ON t."id" = op."transaction_id"
        GROUP BY op."obligation_instance_id"
      ) p ON p.instance_id = i."id"
      WHERE i."tenant_id" = ${tenantId} AND i."period" = ${period}
      GROUP BY i."currency"
      ORDER BY i."currency" ASC
    `

    return rows.map((row) => ({
      currency: row.currency,
      expectedMinor: toNumber(row.expected_minor),
      paidMinor: toNumber(row.paid_minor),
      outstandingMinor: toNumber(row.outstanding_minor),
    }))
  }
}

/**
 * Postgres widens SUM(int) to bigint, which the driver hands back as a BigInt
 * (or a numeric string). Amounts are minor units within safe-integer range, so
 * narrowing here is lossless and keeps the domain on plain numbers.
 */
type RawSummaryRow = {
  currency: string
  expected_minor: bigint | string | number | null
  paid_minor: bigint | string | number | null
  outstanding_minor: bigint | string | number | null
}

function toNumber(value: bigint | string | number | null): number {
  if (value === null) {
    return 0
  }

  return Number(value)
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
