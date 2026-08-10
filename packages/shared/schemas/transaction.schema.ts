import { z } from 'zod'
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
