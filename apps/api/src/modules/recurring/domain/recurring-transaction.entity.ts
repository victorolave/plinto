import { TransactionType } from '../../transactions/domain/transaction.entity'

export type RecurringTransactionFrequency = 'monthly'
export type RecurringExecutionStatus = 'success'

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
  active: boolean
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
