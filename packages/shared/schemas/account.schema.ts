import { z } from 'zod'
import { VALIDATION_CODE, validationIssue } from './validation-code'

export const AccountTypeSchema = z.enum(['cash', 'bank', 'credit', 'savings', 'debt'])

/**
 * Account types that represent money owed rather than money held.
 *
 * A liability account carries a negative balance: what the household owes that
 * lender. `debt` is the type PRD-007 introduces for loans and financed
 * purchases; `credit` was always one of these — a card balance is a debt —
 * and is classified here rather than left as an asset by omission.
 *
 * This exists so the API and the web agree on the question without either one
 * restating the list. Netting a liability into a total silently changes that
 * figure from "what we hold" to "what we are worth".
 */
export const LIABILITY_ACCOUNT_TYPES = ['credit', 'debt'] as const

export function isLiabilityAccountType(type: string): boolean {
  return (LIABILITY_ACCOUNT_TYPES as readonly string[]).includes(type)
}

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
  .refine(
    (value) => Object.values(value).some((field) => field !== undefined),
    validationIssue(VALIDATION_CODE.AT_LEAST_ONE_FIELD),
  )

export type AccountTypeDto = z.infer<typeof AccountTypeSchema>
export type AccountDto = z.infer<typeof AccountSchema>
export type CreateAccountDto = z.infer<typeof CreateAccountSchema>
export type UpdateAccountDto = z.infer<typeof UpdateAccountSchema>
