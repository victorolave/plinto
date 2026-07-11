import { z } from 'zod'

export const AccountTypeSchema = z.enum(['cash', 'bank', 'credit', 'savings'])

export const AccountSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  type: AccountTypeSchema,
  currency: z.string().regex(/^[A-Z]{3}$/),
  createdAt: z.string(),
  archivedAt: z.string().nullable(),
})

export const CreateAccountSchema = z.object({
  name: z.string().trim().min(1),
  type: AccountTypeSchema,
  currency: z.string().trim().regex(/^[A-Z]{3}$/),
})

// Currency is intentionally omitted: transactions carry their own currency and
// balances are grouped by it, so changing an account's currency would desync
// historical data. Only the display fields (name, type) are editable.
export const UpdateAccountSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    type: AccountTypeSchema.optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'At least one field must be provided',
  })

export type AccountTypeDto = z.infer<typeof AccountTypeSchema>
export type AccountDto = z.infer<typeof AccountSchema>
export type CreateAccountDto = z.infer<typeof CreateAccountSchema>
export type UpdateAccountDto = z.infer<typeof UpdateAccountSchema>
