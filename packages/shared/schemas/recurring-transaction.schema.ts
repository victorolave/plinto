import { z } from 'zod'
import { TransactionTypeSchema } from './transaction.schema'

export const RecurringTransactionFrequencySchema = z.enum(['monthly'])

export const CreateRecurringTransactionRuleSchema = z.object({
  name: z.string().trim().min(1),
  accountId: z.string().trim().min(1),
  type: TransactionTypeSchema,
  amountMinor: z.number().int().positive(),
  frequency: RecurringTransactionFrequencySchema.default('monthly'),
  dayOfMonth: z.number().int().min(1).max(28),
  startDate: z.string().datetime(),
  active: z.boolean().default(true),
})

export const RecurringTransactionRuleSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  accountId: z.string(),
  name: z.string(),
  type: TransactionTypeSchema,
  amountMinor: z.number().int(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  frequency: RecurringTransactionFrequencySchema,
  dayOfMonth: z.number().int().min(1).max(28),
  startDate: z.string(),
  active: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type RecurringTransactionFrequencyDto = z.infer<typeof RecurringTransactionFrequencySchema>
export type CreateRecurringTransactionRuleDto = z.infer<typeof CreateRecurringTransactionRuleSchema>
export type RecurringTransactionRuleDto = z.infer<typeof RecurringTransactionRuleSchema>
