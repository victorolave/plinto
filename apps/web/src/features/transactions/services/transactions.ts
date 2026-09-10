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

/**
 * How many rows of each type the current filters match, ignoring the type
 * filter itself. Labels the income/expense tabs, which are what sets that
 * filter — so these describe the whole filtered set, never just this page.
 */
export interface TransactionTypeCounts {
  income: number
  expense: number
}

export interface TransactionListResponse {
  data: { transactions: Transaction[] }
  meta: { pagination: PaginationMeta; counts: TransactionTypeCounts }
}

/**
 * How the ledger can be narrowed. These are applied by the API, not here: the
 * list is paginated, and filtering a single fetched page in the browser would
 * quietly search only what happened to be on screen.
 */
export interface TransactionFilters {
  accountId?: string
  type?: TransactionType
  /** Inclusive calendar day, `YYYY-MM-DD`. */
  dateFrom?: string
  /** Inclusive calendar day, `YYYY-MM-DD`. */
  dateTo?: string
  /** Matched against the description and the account name. */
  search?: string
}

export async function listTransactions(
  params?: TransactionFilters & { page?: number; pageSize?: number },
): Promise<TransactionListResponse> {
  const query = new URLSearchParams()
  // Empty values are dropped rather than sent: `?search=` and no `search` key
  // mean the same thing, and sending both shapes would make two cache entries
  // for one question.
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined || value === '') continue
    query.set(key, String(value))
  }

  const queryString = query.toString()
  const url = queryString ? `/transactions?${queryString}` : '/transactions'
  return apiFetch<TransactionListResponse>(url)
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

/**
 * `idempotencyKey` travels as the `Idempotency-Key` header, never in the
 * body — it is the client's own retry-identity for this submission, not a
 * transfer field. Omitting it keeps today's behaviour: a resubmit creates a
 * second transfer.
 */
export interface CreateTransferResponse {
  data: {
    transfer: Transfer
    debit: Transaction
    credit: Transaction
    /**
     * `true` when this Idempotency-Key was already used for the same
     * transfer and nothing new was created — the API returns 200 for this
     * case, but the status alone is not enough: `apiFetch` (see
     * `lib/api/client.ts`) never surfaces the HTTP status to its caller, so
     * this field is the only way `TransferForm` can tell a replay apart
     * from a fresh creation and say so.
     */
    alreadyExisted: boolean
  }
}

export async function createTransfer(
  input: {
    sourceAccountId: string
    destinationAccountId: string
    sourceAmountMinor: number
    destinationAmountMinor?: number
    fxRate?: string
    feeMinor?: number
    description?: string
    occurredAt?: string
  },
  idempotencyKey?: string,
): Promise<CreateTransferResponse> {
  return apiFetch<CreateTransferResponse>('/transactions/transfers', {
    method: 'POST',
    body: JSON.stringify(input),
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
  })
}
