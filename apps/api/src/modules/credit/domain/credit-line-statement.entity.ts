/**
 * One statement a credit line issued: what is owed in total, what must be
 * paid, and by when. See PRD-011.
 *
 * The unit of truth for a revolving balance. The household does not record the
 * purchases behind it, so the figure the issuer declares is the only one that
 * can be trusted — entered once as a fact, never accumulated from movements.
 */
export type CreditLineStatement = {
  id: string
  tenantId: string
  creditLineId: string
  /** `YYYY-MM`. Grouping only — never identity. Two statements may share it. */
  period: string
  cutoffDate: Date
  dueDate: Date
  closingBalanceMinor: number
  amountDueMinor: number
  /** The ceiling at this cutoff, frozen when the statement was recorded. */
  limitMinorSnapshot: number
  currency: string
  createdAt: Date
  updatedAt: Date
}

/**
 * What the line still had available at that cutoff.
 *
 * Derived, never stored — the same reasoning as obligation status and a debt
 * schedule's outstanding balance. It is measured against the limit recorded on
 * the statement rather than the line's current one, so raising a ceiling today
 * never restates a figure the household already read.
 *
 * May be negative. Fees push real balances past the limit, and an over-limit
 * line is a fact to report, not an error to refuse.
 */
export function availableMinor(statement: CreditLineStatement): number {
  return statement.limitMinorSnapshot - statement.closingBalanceMinor
}

/**
 * The period a statement belongs to, derived from its cutoff.
 *
 * Derived rather than given, so a statement cannot be filed under a month its
 * cutoff does not fall in. UTC for the reason `toPeriod` is: a household in
 * Bogotá and a job server in Frankfurt must agree on which month it is.
 */
export function periodOfCutoff(cutoffDate: Date): string {
  const year = cutoffDate.getUTCFullYear()
  const month = String(cutoffDate.getUTCMonth() + 1).padStart(2, '0')

  return `${year}-${month}`
}

/**
 * What the obligation this statement produces is called.
 *
 * The cutoff is in the name because a line may bill twice in one month, and a
 * board showing two identical rows would leave the household unable to tell
 * which of them it had already paid.
 */
export function statementObligationName(
  lineName: string,
  cutoffDate: Date,
): string {
  const day = String(cutoffDate.getUTCDate()).padStart(2, '0')
  const month = String(cutoffDate.getUTCMonth() + 1).padStart(2, '0')

  return `${lineName} — statement ${day}/${month}`
}
