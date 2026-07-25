import {
  CreateRecurringRuleStatus,
  RecurringRuleStatus,
  RecurringTransactionExecution,
  RecurringTransactionRule,
} from './recurring-transaction.entity'
import { Transaction, TransactionType } from '../../transactions/domain/transaction.entity'

export interface RecurringExecutionResult {
  transaction: Transaction
  execution: RecurringTransactionExecution
}

/**
 * The fields a rule may change after creation. accountId, type, currency and
 * frequency are absent by design: past periods are already materialized as
 * transactions carrying those values, so editing them would leave the rule
 * contradicting its own history.
 */
export interface RecurringRuleUpdate {
  name?: string
  amountMinor?: number
  dayOfMonth?: number
  startDate?: Date
}

/**
 * Port: the recurring-transaction persistence contract the application
 * layer depends on. Adapters (e.g. PrismaRecurringTransactionRepository)
 * live in the infrastructure layer and implement this abstract class, which
 * doubles as the DI token — so the ORM can be swapped by binding a
 * different adapter without touching business logic.
 */
export abstract class RecurringTransactionRepository {
  abstract createRule(data: {
    tenantId: string
    accountId: string
    name: string
    type: TransactionType
    amountMinor: number
    currency: string
    dayOfMonth: number
    startDate: Date
    status: CreateRecurringRuleStatus
  }): Promise<RecurringTransactionRule>

  /**
   * Archived rules are hidden unless explicitly requested, mirroring how
   * archived accounts drop off every active surface.
   */
  abstract listRulesByTenantId(
    tenantId: string,
    options?: { includeArchived?: boolean },
  ): Promise<RecurringTransactionRule[]>

  abstract findRuleByIdForTenant(
    id: string,
    tenantId: string,
  ): Promise<RecurringTransactionRule | null>

  /** Returns null when no rule with that id exists inside the tenant. */
  abstract updateRuleForTenant(
    id: string,
    tenantId: string,
    data: RecurringRuleUpdate,
  ): Promise<RecurringTransactionRule | null>

  /**
   * Moves a rule to a lifecycle state. The legal transitions live in the
   * application layer, which reads the current state first — this port only
   * persists the decision, scoped to the tenant. Returns null when no rule
   * with that id exists inside the tenant.
   */
  abstract setRuleStatusForTenant(
    id: string,
    tenantId: string,
    status: RecurringRuleStatus,
  ): Promise<RecurringTransactionRule | null>

  abstract findExecutionByKey(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<RecurringTransactionExecution | null>

  abstract listActiveMonthlyRulesDueBy(dueDate: Date): Promise<RecurringTransactionRule[]>

  /**
   * Active rules that already existed by the end of `period`, whatever their
   * day of month. Unlike listActiveMonthlyRulesDueBy this does not require the
   * occurrence to have passed, because obligations are materialized ahead of
   * time — that forward projection is the point of the monthly board.
   */
  abstract listActiveMonthlyRulesForPeriod(
    period: string,
  ): Promise<RecurringTransactionRule[]>

  /**
   * Creates the transaction + execution record for a due rule occurrence.
   * Returns null if a concurrent caller already created an execution for the
   * same (tenantId, idempotencyKey) pair — i.e. the unique constraint that
   * backs findExecutionByKey was hit as a race rather than as the initial
   * check. Callers must treat null the same as a pre-existing execution
   * (skip), not as an error.
   */
  abstract createExecutionTransaction(input: {
    rule: RecurringTransactionRule
    period: string
    idempotencyKey: string
    occurredAt: Date
    jobId?: string
  }): Promise<RecurringExecutionResult | null>
}
