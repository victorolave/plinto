import { describe, expect, it } from 'vitest'
import { formatOccurredAtDate } from '../transactions-panel'

describe('formatOccurredAtDate', () => {
  it('shows the UTC calendar date of a UTC-midnight occurredAt (no off-by-one)', () => {
    // Date-only inputs are persisted at UTC midnight. The displayed day must match
    // the date the user picked, never the previous day, regardless of viewer TZ (issue #6).
    const result = formatOccurredAtDate('2026-06-23T00:00:00.000Z')
    expect(result).toContain('23')
    expect(result).not.toContain('22')
  })

  it('does not shift month/day for an end-of-month UTC-midnight date', () => {
    const result = formatOccurredAtDate('2026-12-31T00:00:00.000Z')
    expect(result).toContain('31')
    expect(result).toContain('12')
  })

  it('returns an empty string for an empty value', () => {
    expect(formatOccurredAtDate('')).toBe('')
  })
})
