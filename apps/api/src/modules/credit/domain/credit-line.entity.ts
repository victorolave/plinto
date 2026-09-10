export type CreditLineStatus = 'active' | 'closed'

/**
 * A revolving credit line: a card, or a rotating line such as ADDI. See
 * PRD-011.
 *
 * Not an account, and not a schedule. An account holds money the household
 * has; a schedule repays a fixed plan. This is a ceiling the household may
 * spend against, whose balance grows with use and is settled against a bill
 * the lender issues.
 */
export type CreditLine = {
  id: string
  tenantId: string
  name: string
  /**
   * The ceiling as it stands today. What a past statement was measured
   * against is recorded on that statement, so raising this never restates a
   * figure the household has already read.
   */
  limitMinor: number
  currency: string
  status: CreditLineStatus
  createdAt: Date
  updatedAt: Date
}
