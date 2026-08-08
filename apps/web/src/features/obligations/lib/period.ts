/**
 * Client-side `YYYY-MM` arithmetic for the board's month navigation. Kept in
 * UTC to agree with the server, which assigns every obligation to a period the
 * same way — otherwise a household west of UTC would see the board jump a
 * month at the boundary.
 */

export function currentPeriod(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

export function shiftPeriod(period: string, months: number): string {
  const [year, month] = period.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1 + months, 1))

  return currentPeriod(shifted)
}

/** `2026-07` → `July 2026`, for the board heading. */
export function formatPeriod(period: string): string {
  const [year, month] = period.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, 1))

  return date.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
