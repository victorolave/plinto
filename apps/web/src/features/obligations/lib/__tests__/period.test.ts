import { describe, expect, it } from 'vitest'
import { currentPeriod, formatPeriod, shiftPeriod } from '../period'

describe('board period navigation', () => {
  it('derives the current period in UTC', () => {
    expect(currentPeriod(new Date('2026-07-05T12:00:00.000Z'))).toBe('2026-07')
  })

  // A household west of UTC must not see the board jump a month at the
  // boundary — the server assigns periods the same way.
  it('keeps the last instant of a month inside that month', () => {
    expect(currentPeriod(new Date('2026-07-31T23:59:59.999Z'))).toBe('2026-07')
  })

  it.each([
    ['2026-07', 1, '2026-08'],
    ['2026-07', -1, '2026-06'],
    ['2026-12', 1, '2027-01'],
    ['2026-01', -1, '2025-12'],
  ])('shifts %s by %s to %s', (period, months, expected) => {
    expect(shiftPeriod(period, months)).toBe(expected)
  })

  it('formats a period for the board heading', () => {
    expect(formatPeriod('2026-07')).toMatch(/2026/)
    expect(formatPeriod('2026-07')).not.toContain('2026-07')
  })
})
