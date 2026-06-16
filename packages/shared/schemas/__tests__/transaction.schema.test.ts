import { describe, it, expect } from 'vitest'
import {
  TransactionSchema,
  TransactionTypeSchema,
  CreateTransactionSchema,
} from '../transaction.schema'

describe('TransactionSchema', () => {
  const validTransaction = {
    id: 'transaction-1',
    tenantId: 'tenant-1',
    accountId: 'account-1',
    type: 'income',
    amountMinor: 10000,
    currency: 'COP',
    description: 'Salary payment',
    occurredAt: '2026-06-15T00:00:00.000Z',
    createdAt: '2026-06-15T00:00:00.000Z',
  }

  it('parses a valid transaction', () => {
    const result = TransactionSchema.safeParse(validTransaction)
    expect(result.success).toBe(true)
  })

  it('rejects missing tenantId', () => {
    const { tenantId: _tenantId, ...rest } = validTransaction
    const result = TransactionSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects unsupported transaction type', () => {
    const result = TransactionSchema.safeParse({ ...validTransaction, type: 'transfer' })
    expect(result.success).toBe(false)
  })

  it('rejects non-uppercase currency codes', () => {
    const result = TransactionSchema.safeParse({ ...validTransaction, currency: 'cop' })
    expect(result.success).toBe(false)
  })
})

describe('TransactionTypeSchema', () => {
  it('accepts only income and expense', () => {
    expect(TransactionTypeSchema.options).toEqual(['income', 'expense'])
  })
})

describe('CreateTransactionSchema', () => {
  it('parses valid input', () => {
    const result = CreateTransactionSchema.safeParse({
      accountId: 'account-1',
      type: 'expense',
      amountMinor: 5000,
    })
    expect(result.success).toBe(true)
  })

  it('rejects blank or whitespace-only description', () => {
    const result = CreateTransactionSchema.safeParse({
      accountId: 'account-1',
      type: 'expense',
      amountMinor: 5000,
      description: '   ',
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-positive amountMinor (0)', () => {
    const result = CreateTransactionSchema.safeParse({
      accountId: 'account-1',
      type: 'income',
      amountMinor: 0,
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-positive amountMinor (-1)', () => {
    const result = CreateTransactionSchema.safeParse({
      accountId: 'account-1',
      type: 'income',
      amountMinor: -1,
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-integer amountMinor', () => {
    const result = CreateTransactionSchema.safeParse({
      accountId: 'account-1',
      type: 'expense',
      amountMinor: 10.5,
    })
    expect(result.success).toBe(false)
  })
})
