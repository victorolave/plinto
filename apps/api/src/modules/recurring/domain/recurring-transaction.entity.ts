import { TransactionType } from '../../transactions/domain/transaction.entity'

export type RecurringTransactionFrequency = 'monthly'
export type RecurringExecutionStatus = 'success'

/**
 * Lifecycle of a rule. Only `active` rules are materialized by the execution
 * job; `paused` is a reversible user decision and `archived` is retirement.
 * Archived rules are never deleted — executions reference them with
 * ON DELETE RESTRICT and the audit trail (ADR 0008) must survive.
 */
export type RecurringRuleStatus = 'active' | 'paused' | 'archived'

/**
 * The subset a rule may be born in. A rule that is created already archived
 * has no meaning: archiving retires something that existed first.
 */
export type CreateRecurringRuleStatus = Exclude<RecurringRuleStatus, 'archived'>

export interface RecurringTransactionRule {
  id: string
  tenantId: string
  accountId: string
  name: string
  type: TransactionType
  amountMinor: number
  currency: string
  frequency: RecurringTransactionFrequency
  dayOfMonth: number
  startDate: Date
  status: RecurringRuleStatus
  createdAt: Date
  updatedAt: Date
}

export interface RecurringTransactionExecution {
  id: string
  tenantId: string
  ruleId: string
  period: string
  idempotencyKey: string
  transactionId: string
  status: RecurringExecutionStatus
  jobId: string | null
  createdAt: Date
}
