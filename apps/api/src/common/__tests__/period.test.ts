import { describe, expect, it } from 'vitest'
import {
  addMonths,
  endOfPeriod,
  occurrenceDate,
  parsePeriod,
  periodRange,
  toPeriod,
} from '../period'

describe('period arithmetic', () => {
  it('derives the period of a date in UTC', () => {
    expect(toPeriod(new Date('2026-07-05T12:00:00.000Z'))).toBe('2026-07')
  })

  // A household in Bogotá (UTC-5) and a job server in Frankfurt must agree on
  // which month an obligation belongs to.
  it('assigns the last instant of a month to that month, not the next one', () => {
    expect(toPeriod(new Date('2026-07-31T23:59:59.999Z'))).toBe('2026-07')
    expect(toPeriod(new Date('2026-08-01T00:00:00.000Z'))).toBe('2026-08')
  })

  it('parses a period into its year and month', () => {
    expect(parsePeriod('2026-07')).toEqual({ year: 2026, month: 7 })
  })

  it.each(['2026-13', '2026-00', '2026-7', 'nonsense'])(
    'refuses to parse %s',
    (period) => {
      expect(() => parsePeriod(period)).toThrow()
    },
  )

  describe('addMonths', () => {
    it('advances inside the same year', () => {
      expect(addMonths('2026-07', 3)).toBe('2026-10')
    })

    it('rolls over the year boundary', () => {
      expect(addMonths('2026-11', 3)).toBe('2027-02')
    })

    it('rolls over several years', () => {
      expect(addMonths('2026-01', 25)).toBe('2028-02')
    })

    it('returns the same period when adding nothing', () => {
      expect(addMonths('2026-07', 0)).toBe('2026-07')
    })
  })

  describe('periodRange', () => {
    it('covers the period plus the following months', () => {
      expect(periodRange('2026-07', 3)).toEqual(['2026-07', '2026-08', '2026-09'])
    })

    it('is just the period itself for a horizon of one', () => {
      expect(periodRange('2026-07', 1)).toEqual(['2026-07'])
    })

    it('rolls the year across the horizon', () => {
      expect(periodRange('2026-12', 2)).toEqual(['2026-12', '2027-01'])
    })
  })

  describe('occurrenceDate', () => {
    it('lands on the given day at UTC midnight', () => {
      expect(occurrenceDate('2026-07', 5)).toEqual(new Date('2026-07-05T00:00:00.000Z'))
    })

    // Rules cap dayOfMonth at 28 precisely so this never spills into March.
    it('stays inside February for the highest allowed day', () => {
      expect(occurrenceDate('2026-02', 28)).toEqual(new Date('2026-02-28T00:00:00.000Z'))
    })
  })

  describe('endOfPeriod', () => {
    it('is the last instant of the month', () => {
      expect(endOfPeriod('2026-07')).toEqual(new Date('2026-07-31T23:59:59.999Z'))
    })

    it('handles February in a leap year', () => {
      expect(endOfPeriod('2028-02')).toEqual(new Date('2028-02-29T23:59:59.999Z'))
    })

    it('handles the year boundary', () => {
      expect(endOfPeriod('2026-12')).toEqual(new Date('2026-12-31T23:59:59.999Z'))
    })
  })
})
