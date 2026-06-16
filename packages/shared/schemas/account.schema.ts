import { z } from 'zod'

export const AccountTypeSchema = z.enum(['cash', 'bank', 'credit', 'savings'])

export const AccountSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  type: AccountTypeSchema,
  currency: z.string().regex(/^[A-Z]{3}$/),
  createdAt: z.string(),
})

export const CreateAccountSchema = z.object({
  name: z.string().trim().min(1),
  type: AccountTypeSchema,
  currency: z.string().trim().regex(/^[A-Z]{3}$/),
})

export type AccountTypeDto = z.infer<typeof AccountTypeSchema>
export type AccountDto = z.infer<typeof AccountSchema>
export type CreateAccountDto = z.infer<typeof CreateAccountSchema>
