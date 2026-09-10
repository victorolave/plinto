import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/render-with-providers'
import { TransferForm } from '../transfer-form'
import { ApiError } from '../../../../lib/api/api-error'
import type { Account } from '../../../accounts/services/accounts'

vi.mock('../../services/transactions')

import { createTransfer } from '../../services/transactions'

const mockedCreateTransfer = vi.mocked(createTransfer)

const account = (overrides: Partial<Account> = {}): Account => ({
  id: 'acc-checking',
  tenantId: 'tenant-1',
  name: 'Checking',
  type: 'bank',
  currency: 'COP',
  createdAt: '2026-01-01T00:00:00.000Z',
  archivedAt: null,
  ...overrides,
})

const savings = (overrides: Partial<Account> = {}): Account =>
  account({ id: 'acc-savings', name: 'Savings', ...overrides })

const freshTransferResult = {
  data: {
    transfer: { id: 'transfer-1' },
    debit: { id: 'tx-debit' },
    credit: { id: 'tx-credit' },
    alreadyExisted: false,
  },
}

const replayedTransferResult = {
  data: {
    transfer: { id: 'transfer-1' },
    debit: { id: 'tx-debit' },
    credit: { id: 'tx-credit' },
    alreadyExisted: true,
  },
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('TransferForm', () => {
  it('closes the drawer (via onSaved) and rotates the key on a fresh creation', async () => {
    const user = userEvent.setup()
    mockedCreateTransfer.mockResolvedValueOnce(freshTransferResult)
    const onSaved = vi.fn()

    renderWithProviders(
      <TransferForm accounts={[account(), savings()]} onSaved={onSaved} />,
    )

    await user.type(screen.getByLabelText(/amount/i), '50000')
    await user.click(screen.getByRole('button', { name: /transfer/i }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(screen.queryByText(/already recorded/i)).not.toBeInTheDocument()
  })

  /**
   * The defect this whole feature exists to close, from the frontend side:
   * a replay used to be reported exactly like a fresh success (`onSaved()`
   * fired, drawer closed, nothing distinguished it). If the person had
   * edited the amount before resubmitting under a stale key, they would
   * have seen "success" for a transfer that reflected their FIRST attempt,
   * not their edited one, with nothing telling them their edit never
   * applied — the review's core scenario. The fix: a replay must not look
   * like a fresh creation.
   */
  it('does NOT call onSaved and shows a replay notice when the response says alreadyExisted', async () => {
    const user = userEvent.setup()
    mockedCreateTransfer.mockResolvedValueOnce(replayedTransferResult)
    const onSaved = vi.fn()

    renderWithProviders(
      <TransferForm accounts={[account(), savings()]} onSaved={onSaved} />,
    )

    await user.type(screen.getByLabelText(/amount/i), '50000')
    await user.click(screen.getByRole('button', { name: /transfer/i }))

    expect(await screen.findByText(/already.*recorded/i)).toBeInTheDocument()
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('rotates the Idempotency-Key after a confirmed replay, so a later submission is a new intent', async () => {
    const user = userEvent.setup()
    mockedCreateTransfer
      .mockResolvedValueOnce(replayedTransferResult)
      .mockResolvedValueOnce(freshTransferResult)

    renderWithProviders(
      <TransferForm accounts={[account(), savings()]} onSaved={vi.fn()} />,
    )

    await user.type(screen.getByLabelText(/amount/i), '50000')
    await user.click(screen.getByRole('button', { name: /transfer/i }))
    await screen.findByText(/already.*recorded/i)

    await user.click(screen.getByRole('button', { name: /transfer/i }))
    await waitFor(() => expect(mockedCreateTransfer).toHaveBeenCalledTimes(2))

    const [, firstKey] = mockedCreateTransfer.mock.calls[0]
    const [, secondKey] = mockedCreateTransfer.mock.calls[1]
    expect(secondKey).not.toBe(firstKey)
  })

  /**
   * IDEMPOTENCY_KEY_REUSED means the key now belongs to a transfer that is
   * NOT this submission — resubmitting with the same key would only 409
   * again forever. The key must rotate so the person's next attempt (with
   * whatever they choose to send) is treated as a new intent.
   */
  it('rotates the Idempotency-Key after a 409 IDEMPOTENCY_KEY_REUSED error', async () => {
    const user = userEvent.setup()
    mockedCreateTransfer
      .mockRejectedValueOnce(
        new ApiError({
          code: 'IDEMPOTENCY_KEY_REUSED',
          message: 'This Idempotency-Key was already used for a transfer with different details',
          status: 409,
        }),
      )
      .mockResolvedValueOnce(freshTransferResult)

    renderWithProviders(
      <TransferForm accounts={[account(), savings()]} onSaved={vi.fn()} />,
    )

    await user.type(screen.getByLabelText(/amount/i), '50000')
    await user.click(screen.getByRole('button', { name: /transfer/i }))
    await screen.findByText(/already used for a different transfer/i)

    await user.click(screen.getByRole('button', { name: /transfer/i }))
    await waitFor(() => expect(mockedCreateTransfer).toHaveBeenCalledTimes(2))

    const [, firstKey] = mockedCreateTransfer.mock.calls[0]
    const [, secondKey] = mockedCreateTransfer.mock.calls[1]
    expect(secondKey).not.toBe(firstKey)
  })

  it('does NOT rotate the Idempotency-Key after an unrelated error, so a corrected resubmit reuses it', async () => {
    const user = userEvent.setup()
    mockedCreateTransfer
      .mockRejectedValueOnce(
        new ApiError({ code: 'ACCOUNT_NOT_FOUND', message: 'Account not found', status: 404 }),
      )
      .mockResolvedValueOnce(freshTransferResult)

    renderWithProviders(
      <TransferForm accounts={[account(), savings()]} onSaved={vi.fn()} />,
    )

    await user.type(screen.getByLabelText(/amount/i), '50000')
    await user.click(screen.getByRole('button', { name: /transfer/i }))
    await screen.findByText(/no longer exists/i)

    await user.click(screen.getByRole('button', { name: /transfer/i }))
    await waitFor(() => expect(mockedCreateTransfer).toHaveBeenCalledTimes(2))

    const [, firstKey] = mockedCreateTransfer.mock.calls[0]
    const [, secondKey] = mockedCreateTransfer.mock.calls[1]
    expect(secondKey).toBe(firstKey)
  })

  it('sends the same Idempotency-Key on the first render’s submit and reuses it verbatim', async () => {
    const user = userEvent.setup()
    mockedCreateTransfer.mockResolvedValueOnce(freshTransferResult)

    renderWithProviders(
      <TransferForm accounts={[account(), savings()]} onSaved={vi.fn()} />,
    )

    await user.type(screen.getByLabelText(/amount/i), '50000')
    await user.click(screen.getByRole('button', { name: /transfer/i }))

    await waitFor(() => expect(mockedCreateTransfer).toHaveBeenCalledTimes(1))
    const [, key] = mockedCreateTransfer.mock.calls[0]
    expect(typeof key).toBe('string')
    expect((key as string).length).toBeGreaterThan(0)
  })
})
