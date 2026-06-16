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
})

export const CreateTransactionSchema = z.object({
  accountId: z.string().trim().min(1),
  type: TransactionTypeSchema,
  amountMinor: z.number().int().positive(),
  description: z.string().trim().min(1).optional(),
  occurredAt: z.string().datetime().optional(),
})

export const AccountBalanceSchema = z.object({
  accountId: z.string(),
  accountName: z.string(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  balanceMinor: z.number().int(),
})

export type TransactionTypeDto = z.infer<typeof TransactionTypeSchema>
export type TransactionDto = z.infer<typeof TransactionSchema>
export type CreateTransactionDto = z.infer<typeof CreateTransactionSchema>
export type AccountBalanceDto = z.infer<typeof AccountBalanceSchema>
