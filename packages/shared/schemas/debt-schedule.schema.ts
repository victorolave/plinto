import { z } from 'zod'
import { VALIDATION_CODE, validationIssue } from './validation-code'

export const DebtScheduleStatusSchema = z.enum(['active', 'cancelled'])

/**
 * The most installments a schedule may carry. Ten years of monthly payments —
 * far beyond any retail financing, and low enough that a typo cannot ask
 * generation to materialize thousands of obligations.
 */
export const MAX_INSTALLMENT_COUNT = 120

const scheduleShape = {
  accountId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(120),
  /**
   * The total that will be repaid, interest included — not what the goods
   * cost. Interest is recorded rather than calculated (PRD-007): retail
   * financing is quoted as a total, a count and an installment, and the rate
   * is never one of the three.
   */
  principalMinor: z.number().int().positive(),
  installmentMinor: z.number().int().positive(),
  installmentCount: z.number().int().min(1).max(MAX_INSTALLMENT_COUNT),
  firstDueDate: z.string().datetime(),
}

/**
 * The last installment absorbs whatever the others do not cover, so a schedule
 * always sums to exactly its principal. That has to leave something to pay:
 * installments that already exceed the principal would make the final one zero
 * or negative, which is not a plan anybody agreed to.
 *
 * Lenders do quote numbers that fail to multiply out — one row of the source
 * sheet charges 4 × 59,505 against a credit of 238,023, three pesos short — so
 * a small remainder is expected and only an impossible one is refused.
 */
const lastInstallmentMustBePayable = (value: {
  principalMinor: number
  installmentMinor: number
  installmentCount: number
}) => value.principalMinor - value.installmentMinor * (value.installmentCount - 1) > 0


export const CreateDebtScheduleSchema = z
  .object(scheduleShape)
  .refine(
    lastInstallmentMustBePayable,
    validationIssue(VALIDATION_CODE.LAST_INSTALLMENT_EMPTY, ['installmentMinor']),
  )

/**
 * Only the name is editable, deliberately.
 *
 * Amounts and dates are snapshotted into the obligations a schedule has
 * already produced (PRD-006's *Snapshots*). Editing them afterwards would
 * leave those periods expecting one figure while the plan claims another, and
 * nothing in the system could say which is right.
 */
export const UpdateDebtScheduleSchema = z.object({
  name: z.string().trim().min(1).max(120),
})

export const DebtScheduleSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  accountId: z.string(),
  name: z.string(),
  principalMinor: z.number().int(),
  installmentMinor: z.number().int(),
  installmentCount: z.number().int(),
  firstDueDate: z.string(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  status: DebtScheduleStatusSchema,
  createdAt: z.string(),

  /**
   * Derived, never stored — the same reasoning as obligation status. A stored
   * balance can contradict the payments behind it, and then somebody has to
   * decide which of the two to believe.
   */
  paidMinor: z.number().int(),
  outstandingMinor: z.number().int(),
  /** True once every installment exists and is fully paid. */
  settled: z.boolean(),
})

export type DebtScheduleStatusDto = z.infer<typeof DebtScheduleStatusSchema>
export type DebtScheduleDto = z.infer<typeof DebtScheduleSchema>
export type CreateDebtScheduleDto = z.infer<typeof CreateDebtScheduleSchema>
export type UpdateDebtScheduleDto = z.infer<typeof UpdateDebtScheduleSchema>

/**
 * What a household owes, in one currency.
 *
 * Two figures, never one. They measure different things and the model keeps
 * them apart on purpose:
 *
 * - `scheduledOutstandingMinor` is what remains on financed purchases —
 *   principal minus what their installments have actually been paid.
 * - `lenderOwedMinor` is what the liability accounts themselves carry: loans
 *   received, card balances, anything recorded as a movement.
 *
 * Recording a financed purchase does not move its account's balance today, so
 * the two do not overlap — but nothing in the model *guarantees* they never
 * will, and adding them into a single headline would present a number nobody
 * could defend. Whether a purchase should also post to its account is a real
 * open question, and one figure would have quietly answered it.
 */
export const DebtCurrencyTotalSchema = z.object({
  currency: z.string().regex(/^[A-Z]{3}$/),
  scheduledOutstandingMinor: z.number().int(),
  lenderOwedMinor: z.number().int(),
})

export const DebtSummarySchema = z.object({
  totals: z.array(DebtCurrencyTotalSchema),
})

export type DebtCurrencyTotalDto = z.infer<typeof DebtCurrencyTotalSchema>
export type DebtSummaryDto = z.infer<typeof DebtSummarySchema>
