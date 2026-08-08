export type DebtScheduleStatus = 'active' | 'cancelled'

/**
 * A fixed plan of installments against a liability account — what one row of
 * the `ADDI` sheet holds. See PRD-007.
 */
export type DebtSchedule = {
  id: string
  tenantId: string
  accountId: string
  name: string
  /** Total to be repaid across every installment, interest included. */
  principalMinor: number
  installmentMinor: number
  installmentCount: number
  firstDueDate: Date
  currency: string
  status: DebtScheduleStatus
  createdAt: Date
  updatedAt: Date
}

/**
 * What installment `index` charges, counting from zero.
 *
 * Every installment charges `installmentMinor` except the last, which absorbs
 * whatever the others did not cover. That is not a rounding nicety: lenders
 * quote figures that do not multiply out. One row of the source sheet charges
 * 4 × 59,505 against a credit of 238,023 — three pesos short — and a plan that
 * silently loses those three pesos is a plan that disagrees with the lender.
 *
 * Summing this across every index therefore yields exactly `principalMinor`,
 * by construction rather than by luck.
 */
export function installmentAmountMinor(schedule: DebtSchedule, index: number): number {
  if (index < schedule.installmentCount - 1) {
    return schedule.installmentMinor
  }

  return schedule.principalMinor - schedule.installmentMinor * (schedule.installmentCount - 1)
}

/**
 * Which installment falls in `monthsAfterFirst` months, or null when none does.
 *
 * Generation asks this per period, so a period before the plan started or after
 * it finished simply produces nothing — which is the property a recurring rule
 * cannot express, and the reason a financed purchase is not one.
 */
export function installmentIndexFor(
  schedule: DebtSchedule,
  monthsAfterFirst: number,
): number | null {
  if (monthsAfterFirst < 0 || monthsAfterFirst >= schedule.installmentCount) {
    return null
  }

  return monthsAfterFirst
}

/**
 * The day of the month an installment falls due.
 *
 * Capped at 28 for the same reason recurring rules cap theirs: a plan whose
 * first payment fell on the 31st must not skip February, and must not spill
 * into March and land in the wrong period.
 */
export function installmentDayOfMonth(schedule: DebtSchedule): number {
  return Math.min(schedule.firstDueDate.getUTCDate(), 28)
}

/** Human-readable position, so a board can show "Nevera — 3 of 6". */
export function installmentLabel(schedule: DebtSchedule, index: number): string {
  return `${schedule.name} — ${index + 1} of ${schedule.installmentCount}`
}
