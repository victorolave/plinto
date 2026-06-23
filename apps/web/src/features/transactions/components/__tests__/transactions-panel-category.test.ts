import { describe, expect, it } from 'vitest'
import { buildTransactionCreateInput, buildTransactionUpdateInput } from '../transactions-panel'

describe('TransactionsPanel category input builders', () => {
  it('includes categoryId in create input when provided', () => {
    const input = buildTransactionCreateInput({
      accountId: 'acc-1',
      type: 'expense',
      amountMinor: 5000,
      description: 'Groceries',
      occurredAt: '2026-01-15T00:00:00.000Z',
      categoryId: 'cat-1',
    })
    expect(input.categoryId).toBe('cat-1')
  })

  it('omits categoryId from create input when absent', () => {
    const input = buildTransactionCreateInput({
      accountId: 'acc-1',
      type: 'income',
      amountMinor: 100000,
    })
    expect(input.categoryId).toBeUndefined()
  })

  it('passes categoryId null in update input to clear the assignment', () => {
    const input = buildTransactionUpdateInput({
      accountId: 'acc-1',
      type: 'expense',
      amountMinor: 5000,
      categoryId: null,
    })
    expect(input.categoryId).toBeNull()
  })

  it('includes categoryId string in update input when provided', () => {
    const input = buildTransactionUpdateInput({
      categoryId: 'cat-2',
    })
    expect(input.categoryId).toBe('cat-2')
  })

  it('omits categoryId from update input when not provided', () => {
    const input = buildTransactionUpdateInput({
      amountMinor: 5000,
    })
    expect(input.categoryId).toBeUndefined()
  })
})
