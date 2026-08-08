import { apiFetch } from '../../../lib/api/client'
import type { AccountType } from '../../accounts/services/accounts'

export type TransactionType = 'income' | 'expense'

export interface Transaction {
  id: string
  tenantId: string
  accountId: string
  type: TransactionType
  amountMinor: number
  currency: string
  description: string | null
  occurredAt: string
  createdAt: string
  transferId?: string | null
  source?: 'manual' | 'job'
  recurringRuleId?: string | null
  recurringPeriod?: string | null
  idempotencyKey?: string | null
  categoryId?: string | null
}

export interface AccountBalance {
  accountId: string
  accountName: string
  /** Lets a client separate what the household holds from what it owes. */
  accountType: AccountType
  currency: string
  balanceMinor: number
}

export interface Transfer {
  id: string
  tenantId: string
  sourceAccountId: string
  destinationAccountId: string
  sourceAmountMinor: number
  destinationAmountMinor: number
  sourceCurrency: string
  destinationCurrency: string
  fxRate: string | null
  feeMinor: number | null
  rateSource: string | null
  createdAt: string
}

export interface PaginationMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export async function listTransactions(params?: {
  accountId?: string
  page?: number
  pageSize?: number
}): Promise<{ data: { transactions: Transaction[] }; meta: { pagination: PaginationMeta } }> {
  const query = new URLSearchParams()
  if (params?.accountId) query.set('accountId', params.accountId)
  if (params?.page !== undefined) query.set('page', String(params.page))
  if (params?.pageSize !== undefined) query.set('pageSize', String(params.pageSize))

  const queryString = query.toString()
  const url = queryString ? `/transactions?${queryString}` : '/transactions'
  return apiFetch<{ data: { transactions: Transaction[] }; meta: { pagination: PaginationMeta } }>(url)
}

export async function createTransaction(input: {
  accountId: string
  type: TransactionType
  amountMinor: number
  description?: string
  occurredAt?: string
  categoryId?: string
}): Promise<{ data: { transaction: Transaction } }> {
  return apiFetch<{ data: { transaction: Transaction } }>('/transactions', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateTransaction(
  id: string,
  input: {
    accountId?: string
    type?: TransactionType
    amountMinor?: number
    description?: string | null
    occurredAt?: string
    categoryId?: string | null
  },
): Promise<{ data: { transaction: Transaction } }> {
  return apiFetch<{ data: { transaction: Transaction } }>(`/transactions/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export async function listBalances(): Promise<{ data: { balances: AccountBalance[] } }> {
  return apiFetch<{ data: { balances: AccountBalance[] } }>('/transactions/balances')
}

export async function createTransfer(input: {
  sourceAccountId: string
  destinationAccountId: string
  sourceAmountMinor: number
  destinationAmountMinor?: number
  fxRate?: string
  feeMinor?: number
  description?: string
  occurredAt?: string
}): Promise<{ data: { transfer: Transfer; debit: Transaction; credit: Transaction } }> {
  return apiFetch<{ data: { transfer: Transfer; debit: Transaction; credit: Transaction } }>('/transactions/transfers', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}
