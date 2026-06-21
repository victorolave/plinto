import { z } from 'zod'

export const TransactionTypeSchema = z.enum(['income', 'expense'])

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
})

export const CreateTransactionSchema = z.object({
  accountId: z.string().trim().min(1),
  type: TransactionTypeSchema,
  amountMinor: z.number().int().positive(),
  description: z.string().trim().min(1).optional(),
  occurredAt: z.string().datetime().optional(),
})

export const UpdateTransactionSchema = z.object({
  accountId: z.string().trim().min(1).optional(),
  type: TransactionTypeSchema.optional(),
  amountMinor: z.number().int().positive().optional(),
  description: z.string().trim().min(1).nullable().optional(),
  occurredAt: z.string().datetime().optional(),
}).refine((value) => Object.values(value).some((field) => field !== undefined), {
  message: 'At least one field must be provided',
})

export const AccountBalanceSchema = z.object({
  accountId: z.string(),
  accountName: z.string(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  balanceMinor: z.number().int(),
})

export const CreateTransferSchema = z.object({
  sourceAccountId: z.string().trim().min(1),
  destinationAccountId: z.string().trim().min(1),
  amountMinor: z.number().int().positive(),
  description: z.string().trim().min(1).optional(),
  occurredAt: z.string().datetime().optional(),
}).refine(
  (value) => value.sourceAccountId !== value.destinationAccountId,
  { message: 'Source and destination accounts must differ', path: ['destinationAccountId'] },
)

export type TransactionTypeDto = z.infer<typeof TransactionTypeSchema>
export type TransactionDto = z.infer<typeof TransactionSchema>
export type CreateTransactionDto = z.infer<typeof CreateTransactionSchema>
export type UpdateTransactionDto = z.infer<typeof UpdateTransactionSchema>
export type AccountBalanceDto = z.infer<typeof AccountBalanceSchema>
export type CreateTransferDto = z.infer<typeof CreateTransferSchema>
