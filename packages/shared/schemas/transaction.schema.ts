import { z } from 'zod'
import { PaginationQuerySchema } from '../http/pagination.schema'
import { AccountTypeSchema } from './account.schema'
import { VALIDATION_CODE, validationIssue } from './validation-code'

export const TransactionTypeSchema = z.enum(['income', 'expense'])
export const TransactionSourceSchema = z.enum(['manual', 'job'])

export const TransactionSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  accountId: z.string(),
  type: TransactionTypeSchema,
  amountMinor: z.number().int(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  description: z.string().nullable(),
  occurredAt: z.string(),
  createdAt: z.string(),
  transferId: z.string().nullish(),
  categoryId: z.string().nullish(),
  source: TransactionSourceSchema.optional(),
  recurringRuleId: z.string().nullish(),
  recurringPeriod: z.string().regex(/^\d{4}-\d{2}$/).nullish(),
  idempotencyKey: z.string().nullish(),
})

/**
 * A query-string filter that a cleared form control sends as `''`.
 *
 * `?search=` and no `search` key at all mean the same thing to a reader, so
 * they have to mean the same thing to the contract. Trimming here rather than
 * at each call site also keeps `"mercado"` and `" mercado "` from being two
 * different cache keys upstream.
 */
function optionalFilter<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((value) => {
    if (typeof value !== 'string') return value
    const trimmed = value.trim()
    return trimmed === '' ? undefined : trimmed
  }, schema.optional())
}

/**
 * A calendar date as `<input type="date">` emits it.
 *
 * The shape check alone is not enough: `2026-02-30` matches the pattern and
 * `Date` quietly rolls it forward to 2026-03-02, so a filter for a day that
 * does not exist would return a different day's rows. Round-tripping through
 * `toISOString` is what rejects it instead of guessing.
 */
const CalendarDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`)
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
  }, 'not a real calendar date')

/**
 * Everything the ledger can be narrowed by, in one place.
 *
 * These ran in the browser until the list was paginated. Filtering a single
 * fetched page and calling it a search is wrong the moment there is a second
 * page, so the narrowing moved to where the rows actually live. Dates are
 * compared against the UTC date slice of `occurredAt`, matching how a row
 * renders and how the browser filter used to read it.
 */
export const TransactionListQuerySchema = PaginationQuerySchema.extend({
  type: optionalFilter(TransactionTypeSchema),
  accountId: optionalFilter(z.string()),
  search: optionalFilter(z.string()),
  dateFrom: optionalFilter(CalendarDateSchema),
  dateTo: optionalFilter(CalendarDateSchema),
})

export type TransactionListQuery = z.infer<typeof TransactionListQuerySchema>

export const CreateTransactionSchema = z.object({
  accountId: z.string().trim().min(1),
  type: TransactionTypeSchema,
  amountMinor: z.number().int().positive(),
  description: z.string().trim().min(1).optional(),
  occurredAt: z.string().datetime().optional(),
  categoryId: z.string().trim().min(1).nullish(),
})

export const UpdateTransactionSchema = z.object({
  accountId: z.string().trim().min(1).optional(),
  type: TransactionTypeSchema.optional(),
  amountMinor: z.number().int().positive().optional(),
  description: z.string().trim().min(1).nullable().optional(),
  occurredAt: z.string().datetime().optional(),
  categoryId: z.string().nullable().optional(),
}).refine(
  (value) => Object.values(value).some((field) => field !== undefined),
  validationIssue(VALIDATION_CODE.AT_LEAST_ONE_FIELD),
)

export const AccountBalanceSchema = z.object({
  accountId: z.string(),
  accountName: z.string(),
  /**
   * Carried so a client can tell an asset from a liability without fetching
   * the accounts separately and joining them by hand. Without it every total
   * built from balances nets debt against cash by default.
   */
  accountType: AccountTypeSchema,
  currency: z.string().regex(/^[A-Z]{3}$/),
  balanceMinor: z.number().int(),
})

export const CreateTransferSchema = z.object({
  sourceAccountId: z.string().trim().min(1),
  destinationAccountId: z.string().trim().min(1),
  sourceAmountMinor: z.number().int().positive(),
  destinationAmountMinor: z.number().int().positive().optional(),
  fxRate: z.string().regex(/^\d{1,12}(\.\d{1,8})?$/).optional(),
  feeMinor: z.number().int().nonnegative().optional(),
  description: z.string().trim().min(1).optional(),
  occurredAt: z.string().datetime().optional(),
}).refine(
  (value) => value.sourceAccountId !== value.destinationAccountId,
  validationIssue(VALIDATION_CODE.ACCOUNTS_MUST_DIFFER, ['destinationAccountId']),
)

/**
 * The `Idempotency-Key` header a client may send with `POST /transactions/transfers`.
 *
 * Trimmed and bounded, same as any other client-supplied string field. This
 * is deliberately unrelated to `TransactionSchema.idempotencyKey` and
 * `RecurringTransactionExecution.idempotencyKey`, which the recurring engine
 * generates itself to dedupe its own runs — this one is caller-chosen and
 * travels as a header, never in the body.
 */
export const IDEMPOTENCY_KEY_MAX_LENGTH = 200

export const IdempotencyKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(IDEMPOTENCY_KEY_MAX_LENGTH)

export const TransferSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  sourceAccountId: z.string(),
  destinationAccountId: z.string(),
  sourceAmountMinor: z.number().int(),
  destinationAmountMinor: z.number().int(),
  sourceCurrency: z.string().regex(/^[A-Z]{3}$/),
  destinationCurrency: z.string().regex(/^[A-Z]{3}$/),
  fxRate: z.string().nullable(),
  feeMinor: z.number().int().nullable(),
  rateSource: z.string().nullable(),
  createdAt: z.string(),
})

export type TransferDto = z.infer<typeof TransferSchema>

export type TransactionTypeDto = z.infer<typeof TransactionTypeSchema>
export type TransactionSourceDto = z.infer<typeof TransactionSourceSchema>
export type TransactionDto = z.infer<typeof TransactionSchema>
export type CreateTransactionDto = z.infer<typeof CreateTransactionSchema>
export type UpdateTransactionDto = z.infer<typeof UpdateTransactionSchema>
export type AccountBalanceDto = z.infer<typeof AccountBalanceSchema>
export type CreateTransferDto = z.infer<typeof CreateTransferSchema>
