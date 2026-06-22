import { apiFetch } from '../../../lib/api/client'

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
}

export interface AccountBalance {
  accountId: string
  accountName: string
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

export async function listTransactions(accountId?: string): Promise<{ data: { transactions: Transaction[] } }> {
  const url = accountId ? `/transactions?accountId=${encodeURIComponent(accountId)}` : '/transactions'
  return apiFetch(url)
}

export async function createTransaction(input: {
  accountId: string
  type: TransactionType
  amountMinor: number
  description?: string
  occurredAt?: string
}): Promise<{ data: { transaction: Transaction } }> {
  return apiFetch('/transactions', {
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
  },
): Promise<{ data: { transaction: Transaction } }> {
  return apiFetch(`/transactions/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export async function listBalances(): Promise<{ data: { balances: AccountBalance[] } }> {
  return apiFetch('/transactions/balances')
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
  return apiFetch('/transactions/transfers', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}
