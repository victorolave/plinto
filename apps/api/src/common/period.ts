/**
 * Calendar-period arithmetic on the `YYYY-MM` string the rest of the system
 * already speaks (`Transaction.recurringPeriod`, the recurring executor's
 * idempotency keys). Everything is UTC: a household in Bogotá and a job server
 * in Frankfurt must agree on which month an obligation belongs to.
 */

const PERIOD_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/

export function toPeriod(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export function parsePeriod(period: string): { year: number; month: number } {
  const match = PERIOD_PATTERN.exec(period)

  if (!match) {
    throw new Error(`Invalid period: ${period}`)
  }

  return { year: Number(match[1]), month: Number(match[2]) }
}

/** `2026-11` + 3 → `2027-02`. Month overflow rolls the year, as it must. */
export function addMonths(period: string, months: number): string {
  const { year, month } = parsePeriod(period)
  // Date.UTC normalizes an out-of-range month index into the next year.
  const shifted = new Date(Date.UTC(year, month - 1 + months, 1))

  return toPeriod(shifted)
}

/**
 * How many whole months separate two periods. Negative when `to` precedes
 * `from`, which is how generation tells "this plan had not started yet" from
 * "this is its third installment".
 */
export function monthsBetween(from: string, to: string): number {
  const start = parsePeriod(from)
  const end = parsePeriod(to)

  return (end.year - start.year) * 12 + (end.month - start.month)
}

/** The horizon a generation run covers: `period` plus the next `months - 1`. */
export function periodRange(period: string, months: number): string[] {
  return Array.from({ length: months }, (_, index) => addMonths(period, index))
}

/**
 * The instant an obligation falls due inside its period. Rules cap
 * `dayOfMonth` at 28 precisely so this never spills into the following month
 * in February.
 */
export function occurrenceDate(period: string, dayOfMonth: number): Date {
  const { year, month } = parsePeriod(period)

  return new Date(Date.UTC(year, month - 1, dayOfMonth))
}

/** Last instant of a period, for "did this rule exist yet?" comparisons. */
export function endOfPeriod(period: string): Date {
  const { year, month } = parsePeriod(period)

  return new Date(Date.UTC(year, month, 1) - 1)
}
