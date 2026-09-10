import type { Transaction, TransactionType } from '../services/transactions'
import { FALLBACK_FORMATTING_LOCALE } from '../../../i18n/config'

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

export function formatOccurredAtDate(
  occurredAt: string,
  locale: string = FALLBACK_FORMATTING_LOCALE,
): string {
  if (!occurredAt) return ''
  // occurredAt is stored as a UTC instant; date-only inputs are persisted at UTC
  // midnight. Render the UTC calendar date so the displayed day matches the date
  // the user picked, avoiding a local-timezone off-by-one (issue #6).
  //
  // `locale` is explicit for the same reason the timezone is: leaving either to
  // the runtime makes the server and the browser disagree about the string.
  return new Date(occurredAt).toLocaleDateString(locale, { timeZone: 'UTC' })
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

/**
 * The order income/expense are offered in. Labels come from the catalogue
 * (`transactions.income` / `transactions.expense`) — this module is not a React
 * component and cannot translate, so it carries the values, not the words.
 */
export const TRANSACTION_TYPES: TransactionType[] = ['income', 'expense']
