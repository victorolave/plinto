import { describe, expect, it, vi } from 'vitest'
import { createTransfer } from '../transactions'
import { apiFetch } from '../../../../lib/api/client'

vi.mock('../../../../lib/api/client', () => ({
  apiFetch: vi.fn(),
}))

const transferResult = {
  data: {
    transfer: { id: 'transfer-1' },
    debit: { id: 'tx-debit' },
    credit: { id: 'tx-credit' },
  },
}

describe('createTransfer', () => {
  it('sends no Idempotency-Key header when none is given, matching pre-existing behaviour', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(transferResult)

    await createTransfer({
      sourceAccountId: 'account-1',
      destinationAccountId: 'account-2',
      sourceAmountMinor: 5000,
    })

    expect(apiFetch).toHaveBeenCalledWith('/transactions/transfers', {
      method: 'POST',
      body: JSON.stringify({
        sourceAccountId: 'account-1',
        destinationAccountId: 'account-2',
        sourceAmountMinor: 5000,
      }),
      headers: undefined,
    })
  })

  it('sends the Idempotency-Key header as a header, never in the body', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(transferResult)

    await createTransfer(
      {
        sourceAccountId: 'account-1',
        destinationAccountId: 'account-2',
        sourceAmountMinor: 5000,
      },
      'retry-key-1',
    )

    expect(apiFetch).toHaveBeenCalledWith('/transactions/transfers', {
      method: 'POST',
      body: JSON.stringify({
        sourceAccountId: 'account-1',
        destinationAccountId: 'account-2',
        sourceAmountMinor: 5000,
      }),
      headers: { 'Idempotency-Key': 'retry-key-1' },
    })
  })
})
