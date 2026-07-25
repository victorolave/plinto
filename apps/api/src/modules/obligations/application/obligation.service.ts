import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { AuditService } from '../../audit/application/audit.service'
import { TransactionRepository } from '../../transactions/domain/transaction.repository'
import {
  ResolvedObligationInstance,
  resolveObligationInstance,
} from '../domain/obligation.entity'
import { ObligationRepository } from '../domain/obligation.repository'

const OBLIGATION_NOT_FOUND = {
  code: 'OBLIGATION_NOT_FOUND',
  message: 'Obligation not found for the active tenant',
} as const

const TRANSACTION_NOT_FOUND = {
  code: 'TRANSACTION_NOT_FOUND',
  message: 'Transaction not found for the active tenant',
} as const

const TRANSACTION_ALREADY_RECONCILED = {
  code: 'TRANSACTION_ALREADY_RECONCILED',
  message: 'Transaction already settles another obligation',
} as const

const TRANSACTION_NOT_AN_EXPENSE = {
  code: 'TRANSACTION_NOT_AN_EXPENSE',
  message: 'Only an expense can settle an obligation',
} as const

const CURRENCY_MISMATCH = {
  code: 'OBLIGATION_CURRENCY_MISMATCH',
  message: 'Transaction currency does not match the obligation currency',
} as const

const PAYMENT_NOT_FOUND = {
  code: 'OBLIGATION_PAYMENT_NOT_FOUND',
  message: 'Transaction does not settle this obligation',
} as const

interface MutationContext {
  tenantId: string
  actorUserId: string | null
  correlationId: string
}

@Injectable()
export class ObligationService {
  constructor(
    private readonly obligationRepository: ObligationRepository,
    private readonly transactionRepository: TransactionRepository,
    private readonly auditService: AuditService,
  ) {}

  async listPeriod(
    tenantId: string,
    period: string,
    now: Date = new Date(),
  ): Promise<ResolvedObligationInstance[]> {
    const instances = await this.obligationRepository.listInstancesByPeriod(
      tenantId,
      period,
    )

    return instances.map((instance) => resolveObligationInstance(instance, now))
  }

  /**
   * A one-off obligation with no template behind it — a tax filing, a school
   * enrolment. Always `manual`: the source type is not caller-controlled, so
   * nothing can claim to come from a rule it does not reference.
   */
  async createManualObligation(
    params: MutationContext & {
      name: string
      period: string
      dueDate: string
      expectedAmountMinor: number
      currency: string
      now?: Date
    },
  ): Promise<ResolvedObligationInstance> {
    const instance = await this.obligationRepository.createInstance({
      tenantId: params.tenantId,
      sourceType: 'manual',
      recurringRuleId: null,
      period: params.period,
      dueDate: new Date(params.dueDate),
      name: params.name,
      expectedAmountMinor: params.expectedAmountMinor,
      currency: params.currency,
    })

    await this.audit(params, 'obligation.created', instance.id, {
      name: instance.name,
      period: instance.period,
      expectedAmountMinor: instance.expectedAmountMinor,
      currency: instance.currency,
      sourceType: instance.sourceType,
    })

    return resolveObligationInstance(instance, params.now ?? new Date())
  }

  /**
   * Declares that an existing transaction settles (part of) an obligation.
   *
   * Every check here answers a different way the link could be wrong: the
   * obligation or the transaction belonging to another household, money moving
   * the wrong way, incomparable currencies, or the transaction already
   * settling something else. The last one is also enforced by a unique index,
   * so a concurrent caller cannot slip past this check.
   */
  async reconcile(
    params: MutationContext & {
      obligationId: string
      transactionId: string
      now?: Date
    },
  ): Promise<ResolvedObligationInstance> {
    const instance = await this.obligationRepository.findInstanceByIdForTenant(
      params.obligationId,
      params.tenantId,
    )

    if (!instance) {
      throw new NotFoundException(OBLIGATION_NOT_FOUND)
    }

    const transaction = await this.transactionRepository.findByIdForTenant(
      params.transactionId,
      params.tenantId,
    )

    if (!transaction) {
      throw new NotFoundException(TRANSACTION_NOT_FOUND)
    }

    // Income cannot settle an obligation: an obligation is money owed, and
    // linking a credit to it would report the household as having paid a bill
    // it was actually paid for.
    if (transaction.type !== 'expense') {
      throw new ConflictException(TRANSACTION_NOT_AN_EXPENSE)
    }

    // Settling a COP obligation with a USD transaction would make the period
    // totals add incomparable units. Conversion belongs to PRD-008, not here.
    if (transaction.currency !== instance.currency) {
      throw new ConflictException(CURRENCY_MISMATCH)
    }

    const existingPayment = await this.obligationRepository.findPaymentByTransactionId(
      params.tenantId,
      params.transactionId,
    )

    if (existingPayment) {
      throw new ConflictException(TRANSACTION_ALREADY_RECONCILED)
    }

    const payment = await this.obligationRepository.createPayment({
      tenantId: params.tenantId,
      obligationInstanceId: instance.id,
      transactionId: params.transactionId,
    })

    // null means a concurrent caller claimed the transaction between the check
    // above and this insert — the unique index caught what the check could not.
    if (payment === null) {
      throw new ConflictException(TRANSACTION_ALREADY_RECONCILED)
    }

    await this.audit(params, 'obligation.reconciled', instance.id, {
      transactionId: params.transactionId,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      expectedAmountMinor: instance.expectedAmountMinor,
      period: instance.period,
    })

    return this.reload(instance.id, params.tenantId, params.now ?? new Date())
  }

  /** Undoes a reconciliation, freeing the transaction to settle another one. */
  async removePayment(
    params: MutationContext & {
      obligationId: string
      transactionId: string
      now?: Date
    },
  ): Promise<ResolvedObligationInstance> {
    const instance = await this.obligationRepository.findInstanceByIdForTenant(
      params.obligationId,
      params.tenantId,
    )

    if (!instance) {
      throw new NotFoundException(OBLIGATION_NOT_FOUND)
    }

    const removed = await this.obligationRepository.deletePayment(
      params.tenantId,
      instance.id,
      params.transactionId,
    )

    if (!removed) {
      throw new NotFoundException(PAYMENT_NOT_FOUND)
    }

    await this.audit(params, 'obligation.payment_removed', instance.id, {
      transactionId: params.transactionId,
      period: instance.period,
    })

    return this.reload(instance.id, params.tenantId, params.now ?? new Date())
  }

  private async reload(
    id: string,
    tenantId: string,
    now: Date,
  ): Promise<ResolvedObligationInstance> {
    const instance = await this.obligationRepository.findInstanceByIdForTenant(
      id,
      tenantId,
    )

    if (!instance) {
      throw new NotFoundException(OBLIGATION_NOT_FOUND)
    }

    return resolveObligationInstance(instance, now)
  }

  private async audit(
    context: MutationContext,
    action: string,
    obligationId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.auditService.record({
      tenantId: context.tenantId,
      actorUserId: context.actorUserId,
      action,
      resourceType: 'obligation',
      resourceId: obligationId,
      correlationId: context.correlationId,
      metadata,
    })
  }
}
