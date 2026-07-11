import { apiFetch } from '../../../lib/api/client'
import type { TransactionType } from './transactions'

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
  active: boolean
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
  active?: boolean
}): Promise<{ data: { rule: RecurringTransactionRule } }> {
  return apiFetch<{ data: { rule: RecurringTransactionRule } }>('/recurring-transactions', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}
