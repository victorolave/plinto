import { describe, expect, it } from 'vitest'
import {
  CreateRecurringTransactionRuleSchema,
  RecurringTransactionFrequencySchema,
  RecurringTransactionRuleSchema,
} from '../recurring-transaction.schema'

const validCreateInput = {
  name: 'Monthly rent',
  accountId: 'account-1',
  type: 'expense',
  amountMinor: 250000,
  dayOfMonth: 5,
  startDate: '2026-07-01T00:00:00.000Z',
}

describe('recurring transaction schemas', () => {
  it('accepts a valid monthly rule create input without creating transaction fields', () => {
    const result = CreateRecurringTransactionRuleSchema.parse(validCreateInput)

    expect(result).toEqual({
      ...validCreateInput,
      frequency: 'monthly',
      active: true,
    })
    expect('transactionId' in result).toBe(false)
  })

  it.each([1, 28])('accepts day %s as a valid monthly day', (dayOfMonth) => {
    const result = CreateRecurringTransactionRuleSchema.parse({
      ...validCreateInput,
      dayOfMonth,
    })

    expect(result.dayOfMonth).toBe(dayOfMonth)
  })

  it.each([0, 29])('rejects day %s outside the safe 1-28 range', (dayOfMonth) => {
    const result = CreateRecurringTransactionRuleSchema.safeParse({
      ...validCreateInput,
      dayOfMonth,
    })

    expect(result.success).toBe(false)
  })

  it('rejects non-positive amounts', () => {
    const result = CreateRecurringTransactionRuleSchema.safeParse({
      ...validCreateInput,
      amountMinor: 0,
    })

    expect(result.success).toBe(false)
  })

  it('allows only monthly recurring frequency', () => {
    expect(RecurringTransactionFrequencySchema.parse('monthly')).toBe('monthly')
    expect(RecurringTransactionFrequencySchema.safeParse('weekly').success).toBe(false)
  })

  it('serializes listed rule DTOs with tenant, derived currency, and active state', () => {
    const createdAt = '2026-07-01T00:00:00.000Z'

    const result = RecurringTransactionRuleSchema.parse({
      id: 'rule-1',
      tenantId: 'tenant-1',
      accountId: 'account-1',
      name: 'Monthly salary',
      type: 'income',
      amountMinor: 500000,
      currency: 'COP',
      frequency: 'monthly',
      dayOfMonth: 1,
      startDate: createdAt,
      active: true,
      createdAt,
      updatedAt: createdAt,
    })

    expect(result).toEqual({
      id: 'rule-1',
      tenantId: 'tenant-1',
      accountId: 'account-1',
      name: 'Monthly salary',
      type: 'income',
      amountMinor: 500000,
      currency: 'COP',
      frequency: 'monthly',
      dayOfMonth: 1,
      startDate: createdAt,
      active: true,
      createdAt,
      updatedAt: createdAt,
    })
  })
})
