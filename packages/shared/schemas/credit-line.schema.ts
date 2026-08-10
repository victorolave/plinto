import { z } from 'zod'
import { VALIDATION_CODE, validationParams } from './validation-code'

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
    params: validationParams(VALIDATION_CODE.AT_LEAST_ONE_FIELD),
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

/**
 * One statement a credit line issued. See PRD-011.
 *
 * The unit of truth for a revolving balance: the household does not record the
 * purchases behind it, so what the issuer declares is the only figure that can
 * be trusted. Both amounts are entered, never accumulated.
 */
const statementShape = {
  cutoffDate: z.string().datetime(),
  dueDate: z.string().datetime(),
  /** Total owed as the issuer declares it. Drives available credit. */
  closingBalanceMinor: z.number().int().nonnegative(),
  /** What must be paid against this statement. */
  amountDueMinor: z.number().int().nonnegative(),
}

/**
 * A statement cannot demand more than it says is owed. The database enforces
 * this too, so an import that bypasses the API cannot smuggle one past.
 */
const dueWithinBalance = (value: {
  closingBalanceMinor: number
  amountDueMinor: number
}) => value.amountDueMinor <= value.closingBalanceMinor

const DUE_WITHIN_BALANCE_MESSAGE =
  'The amount due cannot exceed the closing balance'

export const CreateCreditLineStatementSchema = z
  .object(statementShape)
  .refine(dueWithinBalance, {
    message: DUE_WITHIN_BALANCE_MESSAGE,
    path: ['amountDueMinor'],
    params: validationParams(VALIDATION_CODE.DUE_WITHIN_BALANCE),
  })

/**
 * A statement and the obligation it produced are one fact recorded once, not a
 * template and its materialization — so correcting one corrects the other.
 * That is the opposite of a recurring rule, whose amount is snapshotted into
 * each instance precisely so that editing the rule cannot rewrite history.
 *
 * The period is not editable: it is derived from the cutoff, and moving a
 * statement between months would move the obligation with it.
 */
export const UpdateCreditLineStatementSchema = z
  .object({
    dueDate: z.string().datetime().optional(),
    closingBalanceMinor: z.number().int().nonnegative().optional(),
    amountDueMinor: z.number().int().nonnegative().optional(),
  })
  .refine(
    (value) =>
      value.dueDate !== undefined ||
      value.closingBalanceMinor !== undefined ||
      value.amountDueMinor !== undefined,
    {
      message: 'Provide at least one field to update',
      params: validationParams(VALIDATION_CODE.AT_LEAST_ONE_FIELD),
    },
  )

export const CreditLineStatementSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  creditLineId: z.string(),
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  cutoffDate: z.string(),
  dueDate: z.string(),
  closingBalanceMinor: z.number().int(),
  amountDueMinor: z.number().int(),
  /** The ceiling at this cutoff, frozen when the statement was recorded. */
  limitMinorSnapshot: z.number().int(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  createdAt: z.string(),

  /**
   * Derived, never stored: the ceiling at that cutoff minus what it declared
   * owed. May be negative — fees push real balances past the limit, and a
   * system that refuses to record what already happened forces the household
   * to lie to it.
   */
  availableMinor: z.number().int(),
})

export type CreditLineStatusDto = z.infer<typeof CreditLineStatusSchema>
export type CreditLineDto = z.infer<typeof CreditLineSchema>
export type CreateCreditLineDto = z.infer<typeof CreateCreditLineSchema>
export type UpdateCreditLineDto = z.infer<typeof UpdateCreditLineSchema>
export type CreditLineStatementDto = z.infer<typeof CreditLineStatementSchema>
export type CreateCreditLineStatementDto = z.infer<
  typeof CreateCreditLineStatementSchema
>
export type UpdateCreditLineStatementDto = z.infer<
  typeof UpdateCreditLineStatementSchema
>
