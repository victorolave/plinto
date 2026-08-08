import { describe, it, expect } from 'vitest'
import {
  isLiabilityAccountType,
  AccountSchema,
  AccountTypeSchema,
  CreateAccountSchema,
  UpdateAccountSchema,
} from '../account.schema'

describe('AccountSchema', () => {
  const validAccount = {
    id: 'account-1',
    tenantId: 'tenant-1',
    name: 'Main bank account',
    type: 'bank',
    currency: 'COP',
    createdAt: '2026-06-16T00:00:00.000Z',
    archivedAt: null,
  }

  it('parses a valid account', () => {
    const result = AccountSchema.safeParse(validAccount)
    expect(result.success).toBe(true)
  })

  it('parses an archived account', () => {
    const result = AccountSchema.safeParse({
      ...validAccount,
      archivedAt: '2026-07-11T00:00:00.000Z',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing tenantId', () => {
    const { tenantId: _tenantId, ...rest } = validAccount

    const result = AccountSchema.safeParse(rest)

    expect(result.success).toBe(false)
  })

  it('rejects unsupported account type', () => {
    const result = AccountSchema.safeParse({
      ...validAccount,
      type: 'investment',
    })

    expect(result.success).toBe(false)
  })

  it('rejects non-ISO-like currency codes', () => {
    const result = AccountSchema.safeParse({
      ...validAccount,
      currency: 'cop',
    })

    expect(result.success).toBe(false)
  })
})

describe('CreateAccountSchema', () => {
  it('accepts the supported account types', () => {
    expect(AccountTypeSchema.options).toEqual([
      'cash',
      'bank',
      'credit',
      'savings',
      'debt',
    ])
  })

  it('parses valid account creation input', () => {
    const result = CreateAccountSchema.safeParse({
      name: 'Cash wallet',
      type: 'cash',
      currency: 'USD',
    })

    expect(result.success).toBe(true)
  })

  it('rejects blank names', () => {
    const result = CreateAccountSchema.safeParse({
      name: '   ',
      type: 'cash',
      currency: 'USD',
    })

    expect(result.success).toBe(false)
  })
})

describe('UpdateAccountSchema', () => {
  it('accepts a partial update of editable fields', () => {
    expect(UpdateAccountSchema.safeParse({ name: 'Renamed' }).success).toBe(true)
    expect(UpdateAccountSchema.safeParse({ type: 'savings' }).success).toBe(true)
  })

  it('rejects an empty update', () => {
    expect(UpdateAccountSchema.safeParse({}).success).toBe(false)
  })

  it('ignores currency: it is immutable and stripped from the payload', () => {
    const result = UpdateAccountSchema.safeParse({ name: 'Renamed', currency: 'USD' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).not.toHaveProperty('currency')
    }
  })
})

describe('isLiabilityAccountType', () => {
  it.each(['cash', 'bank', 'savings'])('treats %s as money held', (type) => {
    expect(isLiabilityAccountType(type)).toBe(false)
  })

  /**
   * `debt` is what PRD-007 introduces. `credit` was always one of these — a
   * card balance is money owed — and is classified here rather than left as an
   * asset by omission, which is what it was before.
   */
  it.each(['credit', 'debt'])('treats %s as money owed', (type) => {
    expect(isLiabilityAccountType(type)).toBe(true)
  })

  /**
   * This function is the single place that answers the question, so that the
   * API and the web cannot disagree about it. Every declared account type must
   * therefore land on one side or the other — a type nobody classified would
   * silently count as an asset.
   */
  it('classifies every account type the schema admits', () => {
    for (const type of AccountTypeSchema.options) {
      expect(typeof isLiabilityAccountType(type)).toBe('boolean')
    }
    expect(AccountTypeSchema.options.filter(isLiabilityAccountType)).toEqual([
      'credit',
      'debt',
    ])
  })

  it('does not treat an unknown type as a liability', () => {
    expect(isLiabilityAccountType('crypto')).toBe(false)
  })
})
