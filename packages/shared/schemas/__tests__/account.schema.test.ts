import { describe, it, expect } from 'vitest'
import {
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
