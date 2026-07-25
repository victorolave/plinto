import { describe, expect, it, vi } from 'vitest'
import {
  createObligation,
  getObligationSummary,
  listObligations,
  reconcileObligation,
  removeObligationPayment,
} from '../obligations'
import { apiFetch } from '../../../../lib/api/client'

vi.mock('../../../../lib/api/client', () => ({
  apiFetch: vi.fn(),
}))

describe('obligations API service', () => {
  it('lists a period', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ data: { obligations: [] } })

    await listObligations('2026-07')

    expect(apiFetch).toHaveBeenCalledWith('/obligations?period=2026-07')
  })

  // Omitting the period lets the server answer with the current month.
  it('omits the period when none is given', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ data: { obligations: [] } })

    await listObligations()

    expect(apiFetch).toHaveBeenCalledWith('/obligations')
  })

  it('fetches the period summary from its own endpoint', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      data: { summary: { period: '2026-07', totals: [] } },
    })

    await getObligationSummary('2026-07')

    expect(apiFetch).toHaveBeenCalledWith('/obligations/summary?period=2026-07')
  })

  it('records a one-off obligation', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ data: { obligation: { id: 'o-1' } } })

    await createObligation({
      name: 'Income tax filing',
      period: '2026-07',
      dueDate: '2026-07-15T00:00:00.000Z',
      expectedAmountMinor: 120000,
      currency: 'COP',
    })

    expect(apiFetch).toHaveBeenCalledWith('/obligations', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Income tax filing',
        period: '2026-07',
        dueDate: '2026-07-15T00:00:00.000Z',
        expectedAmountMinor: 120000,
        currency: 'COP',
      }),
    })
  })

  it('reconciles an obligation with a transaction', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ data: { obligation: { id: 'o-1' } } })

    await reconcileObligation('o-1', 'tx-1')

    expect(apiFetch).toHaveBeenCalledWith('/obligations/o-1/payments', {
      method: 'POST',
      body: JSON.stringify({ transactionId: 'tx-1' }),
    })
  })

  it('removes a payment from an obligation', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ data: { obligation: { id: 'o-1' } } })

    await removeObligationPayment('o-1', 'tx-1')

    expect(apiFetch).toHaveBeenCalledWith('/obligations/o-1/payments/tx-1', {
      method: 'DELETE',
    })
  })

  it('encodes ids that would otherwise break out of the path', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ data: { obligation: { id: 'a/b' } } })

    await removeObligationPayment('a/b', 'c/d')

    expect(apiFetch).toHaveBeenCalledWith('/obligations/a%2Fb/payments/c%2Fd', {
      method: 'DELETE',
    })
  })
})
