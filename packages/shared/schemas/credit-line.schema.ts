import { z } from 'zod'

export const CreditLineStatusSchema = z.enum(['active', 'closed'])

/**
 * A revolving credit line: a card, or a rotating line such as ADDI. See
 * PRD-011.
 *
 * Four fields, and none of them describe a billing cycle. What the line bills
 * and when is carried by each statement, because the lender decides it and can
 * change it — some of these offer a choice between monthly and biweekly. A
 * cycle stored here would be a second opinion about a fact the statements
 * already state.
 */
const creditLineShape = {
  name: z.string().trim().min(1).max(120),
  /**
   * The ceiling. Zero is allowed: a line the issuer has suspended still holds
   * a balance the household owes, and refusing to record it would push that
   * debt out of view.
   */
  limitMinor: z.number().int().nonnegative(),
  currency: z.string().trim().regex(/^[A-Z]{3}$/),
}

export const CreateCreditLineSchema = z.object(creditLineShape)

/**
 * Name and limit are editable; currency is not.
 *
 * Issuers raise and lower ceilings, and the line has to be able to say what
 * its ceiling is today. Past statements are unaffected — each one records the
 * limit it was measured against, so editing this never restates a figure the
 * household has already read.
 *
 * Currency is omitted for the reason accounts omit it: the statements below
 * carry their own amounts, and changing the denomination above them would
 * reinterpret every one of those numbers without touching a digit.
 */
export const UpdateCreditLineSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    limitMinor: z.number().int().nonnegative().optional(),
  })
  .refine((value) => value.name !== undefined || value.limitMinor !== undefined, {
    message: 'Provide at least one field to update',
  })

export const CreditLineSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  limitMinor: z.number().int(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  status: CreditLineStatusSchema,
  createdAt: z.string(),
})

export type CreditLineStatusDto = z.infer<typeof CreditLineStatusSchema>
export type CreditLineDto = z.infer<typeof CreditLineSchema>
export type CreateCreditLineDto = z.infer<typeof CreateCreditLineSchema>
export type UpdateCreditLineDto = z.infer<typeof UpdateCreditLineSchema>
