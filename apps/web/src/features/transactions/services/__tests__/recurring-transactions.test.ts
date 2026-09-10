import { describe, expect, it, vi } from 'vitest'
import {
  archiveRecurringTransactionRule,
  createRecurringTransactionRule,
  listRecurringTransactionRules,
  pauseRecurringTransactionRule,
  restoreRecurringTransactionRule,
  resumeRecurringTransactionRule,
  updateRecurringTransactionRule,
} from '../recurring-transactions'
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

  it('asks for archived rules only when requested', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ data: { rules: [] } })

    await listRecurringTransactionRules({ includeArchived: true })

    expect(apiFetch).toHaveBeenCalledWith('/recurring-transactions?includeArchived=true')
  })

  it('sends only the mutable fields on update', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ data: { rule: { id: 'rule-1' } } })

    await updateRecurringTransactionRule('rule-1', { amountMinor: 300000 })

    expect(apiFetch).toHaveBeenCalledWith('/recurring-transactions/rule-1', {
      method: 'PATCH',
      body: JSON.stringify({ amountMinor: 300000 }),
    })
  })

  it.each([
    ['pause', pauseRecurringTransactionRule, '/recurring-transactions/rule-1/pause', 'POST'],
    ['resume', resumeRecurringTransactionRule, '/recurring-transactions/rule-1/resume', 'POST'],
    ['restore', restoreRecurringTransactionRule, '/recurring-transactions/rule-1/restore', 'POST'],
    // Archive rather than delete: the rule is retired, its history survives.
    ['archive', archiveRecurringTransactionRule, '/recurring-transactions/rule-1', 'DELETE'],
  ] as const)('routes %s to its endpoint and verb', async (_label, action, path, method) => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ data: { rule: { id: 'rule-1' } } })

    await action('rule-1')

    expect(apiFetch).toHaveBeenCalledWith(path, { method })
  })

  it('encodes ids that would otherwise break out of the path', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ data: { rule: { id: 'a/b' } } })

    await pauseRecurringTransactionRule('a/b')

    expect(apiFetch).toHaveBeenCalledWith('/recurring-transactions/a%2Fb/pause', {
      method: 'POST',
    })
  })
})
