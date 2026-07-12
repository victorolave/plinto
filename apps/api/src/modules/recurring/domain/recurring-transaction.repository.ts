import {
  RecurringTransactionExecution,
  RecurringTransactionRule,
} from './recurring-transaction.entity'
import { Transaction, TransactionType } from '../../transactions/domain/transaction.entity'

export interface RecurringExecutionResult {
  transaction: Transaction
  execution: RecurringTransactionExecution
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
    active: boolean
  }): Promise<RecurringTransactionRule>

  abstract listRulesByTenantId(tenantId: string): Promise<RecurringTransactionRule[]>

  abstract findExecutionByKey(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<RecurringTransactionExecution | null>

  abstract listActiveMonthlyRulesDueBy(dueDate: Date): Promise<RecurringTransactionRule[]>

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
