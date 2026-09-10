import { describe, expect, it } from 'vitest'
import {
  CreateRecurringTransactionRuleSchema,
  RecurringRuleStatusSchema,
  RecurringTransactionFrequencySchema,
  RecurringTransactionRuleSchema,
  UpdateRecurringTransactionRuleSchema,
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
      status: 'active',
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

  it('accepts a rule created directly in the paused state', () => {
    const result = CreateRecurringTransactionRuleSchema.parse({
      ...validCreateInput,
      status: 'paused',
    })

    expect(result.status).toBe('paused')
  })

  // A rule that is born archived has no meaning: archiving retires something
  // that existed. The create contract is deliberately narrower than the entity.
  it('rejects creating a rule that is already archived', () => {
    const result = CreateRecurringTransactionRuleSchema.safeParse({
      ...validCreateInput,
      status: 'archived',
    })

    expect(result.success).toBe(false)
  })

  it.each(['active', 'paused', 'archived'])(
    'recognises %s as a rule lifecycle state',
    (status) => {
      expect(RecurringRuleStatusSchema.parse(status)).toBe(status)
    },
  )

  it('rejects lifecycle states outside the enum', () => {
    expect(RecurringRuleStatusSchema.safeParse('deleted').success).toBe(false)
  })

  it('serializes listed rule DTOs with tenant, derived currency, and lifecycle state', () => {
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
      status: 'active',
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
      status: 'active',
      createdAt,
      updatedAt: createdAt,
    })
  })

  describe('UpdateRecurringTransactionRuleSchema', () => {
    it('accepts a partial edit of the mutable fields', () => {
      const result = UpdateRecurringTransactionRuleSchema.parse({ amountMinor: 300000 })

      expect(result).toEqual({ amountMinor: 300000 })
    })

    it('rejects an empty payload', () => {
      const result = UpdateRecurringTransactionRuleSchema.safeParse({})

      expect(result.success).toBe(false)
    })

    // Past periods are already materialized as transactions carrying the
    // rule's account, type and currency; letting these change would leave the
    // rule contradicting its own history.
    it.each(['accountId', 'type', 'currency', 'frequency'])(
      'strips the immutable field %s instead of applying it',
      (field) => {
        const result = UpdateRecurringTransactionRuleSchema.parse({
          name: 'Rent',
          [field]: 'whatever',
        })

        expect(field in result).toBe(false)
      },
    )

    // Lifecycle transitions go through the explicit pause/resume/archive
    // endpoints, so "stop posting money" is never a side effect of a field edit.
    it('strips status instead of allowing a lifecycle change through an edit', () => {
      const result = UpdateRecurringTransactionRuleSchema.parse({
        name: 'Rent',
        status: 'archived',
      })

      expect('status' in result).toBe(false)
    })
  })
})
