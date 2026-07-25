import { apiFetch } from '../../../lib/api/client'
import type { TransactionType } from './transactions'

/**
 * A rule sits in exactly one lifecycle state. Only `active` rules are posted
 * by the execution job; `paused` is reversible and `archived` is retirement
 * (restorable — rules are never deleted, so their history survives).
 */
export type RecurringRuleStatus = 'active' | 'paused' | 'archived'

export interface RecurringTransactionRule {
  id: string
  tenantId: string
  accountId: string
  name: string
  type: TransactionType
  amountMinor: number
  currency: string
  frequency: 'monthly'
  dayOfMonth: number
  startDate: string
  status: RecurringRuleStatus
  createdAt: string
  updatedAt: string
}

export async function listRecurringTransactionRules(): Promise<{ data: { rules: RecurringTransactionRule[] } }> {
  return apiFetch<{ data: { rules: RecurringTransactionRule[] } }>('/recurring-transactions')
}

export async function createRecurringTransactionRule(input: {
  name: string
  accountId: string
  type: TransactionType
  amountMinor: number
  dayOfMonth: number
  startDate: string
  status?: Exclude<RecurringRuleStatus, 'archived'>
}): Promise<{ data: { rule: RecurringTransactionRule } }> {
  return apiFetch<{ data: { rule: RecurringTransactionRule } }>('/recurring-transactions', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}
