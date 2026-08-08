import { z } from 'zod'

/**
 * Recording a loan the household received.
 *
 * Cash arrives and the household owes it back, so this moves money **from** the
 * lender's liability account **to** the account that received it. Expressing it
 * as a movement rather than as income is what keeps it out of the household's
 * income figure structurally, instead of by a convention somebody has to
 * remember — which is exactly the distinction the source spreadsheet maintains
 * by hand, in a column beside its income.
 */
export const CreateLoanSchema = z.object({
  /** The lender. Must be a liability account. */
  lenderAccountId: z.string().trim().min(1),
  /** Where the money landed. Must not be a liability account. */
  destinationAccountId: z.string().trim().min(1),
  /**
   * What was borrowed, in the currency both accounts share. This is the cash
   * received, not the total that will be repaid — interest belongs to the
   * repayment plan (PRD-007 §3), which a loan on its own does not have.
   */
  amountMinor: z.number().int().positive(),
  description: z.string().trim().max(500).optional(),
  occurredAt: z.string().datetime().optional(),
})

export type CreateLoanDto = z.infer<typeof CreateLoanSchema>
