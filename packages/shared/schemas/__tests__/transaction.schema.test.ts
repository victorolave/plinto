import { describe, it, expect } from 'vitest'
import {
  TransactionSchema,
  TransactionTypeSchema,
  CreateTransactionSchema,
  UpdateTransactionSchema,
  CreateTransferSchema,
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

  it('parses recurring provenance for automatic transactions', () => {
    const result = TransactionSchema.parse({
      ...validTransaction,
      source: 'job',
      recurringRuleId: 'rule-1',
      recurringPeriod: '2026-07',
      idempotencyKey: 'recurring:rule-1:2026-07',
    })

    expect(result.source).toBe('job')
    expect(result.recurringRuleId).toBe('rule-1')
    expect(result.recurringPeriod).toBe('2026-07')
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

describe('UpdateTransactionSchema', () => {
  it('parses a partial transaction correction', () => {
    const result = UpdateTransactionSchema.safeParse({
      type: 'expense',
      amountMinor: 7500,
      description: 'Corrected grocery amount',
    })

    expect(result.success).toBe(true)
  })

  it('allows clearing the description explicitly', () => {
    const result = UpdateTransactionSchema.safeParse({
      description: null,
    })

    expect(result.success).toBe(true)
  })

  it('rejects an empty correction payload', () => {
    const result = UpdateTransactionSchema.safeParse({})

    expect(result.success).toBe(false)
  })

  it('rejects a correction payload with only undefined values', () => {
    const result = UpdateTransactionSchema.safeParse({
      amountMinor: undefined,
    })

    expect(result.success).toBe(false)
  })

  it('rejects non-positive amountMinor', () => {
    const result = UpdateTransactionSchema.safeParse({
      amountMinor: 0,
    })

    expect(result.success).toBe(false)
  })

  it('rejects blank description while still allowing null clear', () => {
    const result = UpdateTransactionSchema.safeParse({
      description: '   ',
    })

    expect(result.success).toBe(false)
  })
})

describe('TransactionSchema with transferId', () => {
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

  it('accepts a transaction with a transferId string', () => {
    const result = TransactionSchema.safeParse({ ...validTransaction, transferId: 'transfer-uuid' })
    expect(result.success).toBe(true)
  })

  it('accepts a transaction with transferId as null', () => {
    const result = TransactionSchema.safeParse({ ...validTransaction, transferId: null })
    expect(result.success).toBe(true)
  })

  it('accepts a transaction without transferId (absent)', () => {
    const result = TransactionSchema.safeParse(validTransaction)
    expect(result.success).toBe(true)
  })
})

describe('TransactionSchema with categoryId', () => {
  const validTransaction = {
    id: 'transaction-1',
    tenantId: 'tenant-1',
    accountId: 'account-1',
    type: 'expense',
    amountMinor: 5000,
    currency: 'USD',
    description: null,
    occurredAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
  }

  it('accepts a transaction with a categoryId string', () => {
    const result = TransactionSchema.safeParse({ ...validTransaction, categoryId: 'cat-1' })
    expect(result.success).toBe(true)
  })

  it('accepts a transaction with categoryId as null', () => {
    const result = TransactionSchema.safeParse({ ...validTransaction, categoryId: null })
    expect(result.success).toBe(true)
  })

  it('accepts a transaction without categoryId (absent)', () => {
    const result = TransactionSchema.safeParse(validTransaction)
    expect(result.success).toBe(true)
  })
})

describe('CreateTransactionSchema with categoryId', () => {
  it('accepts categoryId as a non-empty string', () => {
    const result = CreateTransactionSchema.safeParse({
      accountId: 'account-1',
      type: 'expense',
      amountMinor: 5000,
      categoryId: 'cat-1',
    })
    expect(result.success).toBe(true)
  })

  it('accepts without categoryId (uncategorized)', () => {
    const result = CreateTransactionSchema.safeParse({
      accountId: 'account-1',
      type: 'expense',
      amountMinor: 5000,
    })
    expect(result.success).toBe(true)
  })

  it('accepts categoryId as null (uncategorized via null)', () => {
    const result = CreateTransactionSchema.safeParse({
      accountId: 'account-1',
      type: 'expense',
      amountMinor: 5000,
      categoryId: null,
    })
    expect(result.success).toBe(true)
  })
})

describe('UpdateTransactionSchema with categoryId', () => {
  it('accepts categoryId as a non-empty string to assign', () => {
    const result = UpdateTransactionSchema.safeParse({ categoryId: 'cat-1' })
    expect(result.success).toBe(true)
  })

  it('accepts categoryId as null to clear assignment', () => {
    const result = UpdateTransactionSchema.safeParse({ categoryId: null })
    expect(result.success).toBe(true)
  })

  it('accepts without categoryId (no change to category)', () => {
    const result = UpdateTransactionSchema.safeParse({ amountMinor: 5000 })
    expect(result.success).toBe(true)
  })
})

describe('CreateTransferSchema', () => {
  const validSameCurrencyTransfer = {
    sourceAccountId: 'account-1',
    destinationAccountId: 'account-2',
    sourceAmountMinor: 5000,
  }

  const validCrossCurrencyTransfer = {
    sourceAccountId: 'account-1',
    destinationAccountId: 'account-2',
    sourceAmountMinor: 100000,
    destinationAmountMinor: 50,
    fxRate: '4200.00',
  }

  it('parses a valid same-currency transfer (no fxRate/destinationAmountMinor)', () => {
    const result = CreateTransferSchema.safeParse(validSameCurrencyTransfer)
    expect(result.success).toBe(true)
  })

  it('parses a valid cross-currency transfer (with fxRate + destinationAmountMinor)', () => {
    const result = CreateTransferSchema.safeParse(validCrossCurrencyTransfer)
    expect(result.success).toBe(true)
  })

  it('parses a cross-currency transfer with optional feeMinor', () => {
    const result = CreateTransferSchema.safeParse({ ...validCrossCurrencyTransfer, feeMinor: 200 })
    expect(result.success).toBe(true)
  })

  it('rejects fxRate with invalid format (not a decimal string)', () => {
    const result = CreateTransferSchema.safeParse({ ...validCrossCurrencyTransfer, fxRate: 'abc' })
    expect(result.success).toBe(false)
  })

  it('rejects fxRate as a float number (must be string)', () => {
    const result = CreateTransferSchema.safeParse({ ...validCrossCurrencyTransfer, fxRate: 4200 })
    expect(result.success).toBe(false)
  })

  it('rejects non-positive sourceAmountMinor (0)', () => {
    const result = CreateTransferSchema.safeParse({ ...validSameCurrencyTransfer, sourceAmountMinor: 0 })
    expect(result.success).toBe(false)
  })

  it('rejects non-positive destinationAmountMinor (0)', () => {
    const result = CreateTransferSchema.safeParse({ ...validCrossCurrencyTransfer, destinationAmountMinor: 0 })
    expect(result.success).toBe(false)
  })

  it('rejects negative sourceAmountMinor', () => {
    const result = CreateTransferSchema.safeParse({ ...validSameCurrencyTransfer, sourceAmountMinor: -100 })
    expect(result.success).toBe(false)
  })

  it('rejects missing sourceAccountId', () => {
    const { sourceAccountId: _s, ...rest } = validSameCurrencyTransfer
    const result = CreateTransferSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects missing destinationAccountId', () => {
    const { destinationAccountId: _d, ...rest } = validSameCurrencyTransfer
    const result = CreateTransferSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects when source and destination are the same', () => {
    const result = CreateTransferSchema.safeParse({
      ...validSameCurrencyTransfer,
      destinationAccountId: 'account-1',
    })
    expect(result.success).toBe(false)
  })

  it('rejects fxRate with more than 12 integer digits', () => {
    const result = CreateTransferSchema.safeParse({
      ...validCrossCurrencyTransfer,
      fxRate: '1234567890123.00',
    })
    expect(result.success).toBe(false)
  })

  it('rejects fxRate with more than 8 decimal digits', () => {
    const result = CreateTransferSchema.safeParse({
      ...validCrossCurrencyTransfer,
      fxRate: '4200.123456789',
    })
    expect(result.success).toBe(false)
  })

  it('accepts fxRate at the boundary of 12 integer digits and 8 decimal digits', () => {
    const result = CreateTransferSchema.safeParse({
      ...validCrossCurrencyTransfer,
      fxRate: '123456789012.12345678',
    })
    expect(result.success).toBe(true)
  })
})
