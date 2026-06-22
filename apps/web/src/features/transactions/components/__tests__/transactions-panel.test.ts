import { describe, expect, it } from 'vitest'
import { isAutomaticRecurringTransaction } from '../transactions-panel'

describe('TransactionsPanel recurring provenance helpers', () => {
  it('shows automatic recurring indicator only when job source and recurring metadata exist', () => {
    expect(
      isAutomaticRecurringTransaction({
        source: 'job',
        recurringRuleId: 'rule-1',
        recurringPeriod: '2026-07',
      }),
    ).toBe(true)
  })

  it('does not mark manual transactions as automatic even if descriptions look recurring', () => {
    expect(
      isAutomaticRecurringTransaction({
        source: 'manual',
        recurringRuleId: null,
        recurringPeriod: null,
        description: 'Monthly rent',
      }),
    ).toBe(false)
  })
})
