import type { Transaction, TransactionType } from '../services/transactions'

export interface TransactionCreateInput {
  accountId: string
  type: TransactionType
  amountMinor: number
  description?: string
  occurredAt?: string
  categoryId?: string
}

export interface TransactionUpdateInput {
  accountId?: string
  type?: TransactionType
  amountMinor?: number
  description?: string | null
  occurredAt?: string
  categoryId?: string | null
}

export function buildTransactionCreateInput(
  input: TransactionCreateInput,
): TransactionCreateInput {
  const result: TransactionCreateInput = {
    accountId: input.accountId,
    type: input.type,
    amountMinor: input.amountMinor,
  }
  if (input.description !== undefined) result.description = input.description
  if (input.occurredAt !== undefined) result.occurredAt = input.occurredAt
  if (input.categoryId !== undefined) result.categoryId = input.categoryId
  return result
}

export function buildTransactionUpdateInput(
  input: TransactionUpdateInput,
): TransactionUpdateInput {
  const result: TransactionUpdateInput = {}
  if (input.accountId !== undefined) result.accountId = input.accountId
  if (input.type !== undefined) result.type = input.type
  if (input.amountMinor !== undefined) result.amountMinor = input.amountMinor
  if (input.description !== undefined) result.description = input.description
  if (input.occurredAt !== undefined) result.occurredAt = input.occurredAt
  if ('categoryId' in input) result.categoryId = input.categoryId
  return result
}

export function formatOccurredAtDate(occurredAt: string): string {
  if (!occurredAt) return ''
  // occurredAt is stored as a UTC instant; date-only inputs are persisted at UTC
  // midnight. Render the UTC calendar date so the displayed day matches the date
  // the user picked, avoiding a local-timezone off-by-one (issue #6).
  return new Date(occurredAt).toLocaleDateString(undefined, { timeZone: 'UTC' })
}

export function isAutomaticRecurringTransaction(
  transaction: Pick<Transaction, 'source' | 'recurringRuleId' | 'recurringPeriod'>,
): boolean {
  return (
    transaction.source === 'job' &&
    Boolean(transaction.recurringRuleId) &&
    Boolean(transaction.recurringPeriod)
  )
}

/** Convert a date-only input (YYYY-MM-DD) to a UTC-midnight ISO instant. */
export function toOccurredAtIso(value: string): string | undefined {
  if (!value) return undefined
  return new Date(`${value}T00:00:00.000Z`).toISOString()
}

export const transactionTypeOptions: Array<{ value: TransactionType; label: string }> = [
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
]
