import { describe, expect, it, vi } from 'vitest'
import { createRecurringTransactionRule, listRecurringTransactionRules } from '../recurring-transactions'
import { apiFetch } from '../../../../lib/api/client'

vi.mock('../../../../lib/api/client', () => ({
  apiFetch: vi.fn(),
}))

describe('recurring transaction API service', () => {
  it('lists recurring transaction rules from the dedicated endpoint', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ data: { rules: [{ id: 'rule-1' }] } })

    const result = await listRecurringTransactionRules()

    expect(apiFetch).toHaveBeenCalledWith('/recurring-transactions')
    expect(result).toEqual({ data: { rules: [{ id: 'rule-1' }] } })
  })

  it('serializes monthly rule creation without transaction creation fields', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ data: { rule: { id: 'rule-1' } } })

    await createRecurringTransactionRule({
      name: 'Monthly rent',
      accountId: 'account-1',
      type: 'expense',
      amountMinor: 250000,
      dayOfMonth: 5,
      startDate: '2026-07-01T00:00:00.000Z',
    })

    expect(apiFetch).toHaveBeenCalledWith('/recurring-transactions', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Monthly rent',
        accountId: 'account-1',
        type: 'expense',
        amountMinor: 250000,
        dayOfMonth: 5,
        startDate: '2026-07-01T00:00:00.000Z',
      }),
    })
  })
})
