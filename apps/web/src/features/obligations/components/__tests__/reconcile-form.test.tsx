import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/render-with-providers'
import { ReconcileForm } from '../reconcile-form'
import { reconcileObligation } from '../../services/obligations'
import type { ObligationInstance } from '../../services/obligations'
import type { Transaction } from '../../../transactions/services/transactions'
import type { Account } from '../../../accounts/services/accounts'

vi.mock('../../services/obligations', async () => {
  const actual = await vi.importActual('../../services/obligations')
  return { ...actual, reconcileObligation: vi.fn() }
})

const obligation = {
  id: 'obligation-1',
  name: 'Arriendo',
  currency: 'COP',
  expectedAmountMinor: 1800000,
  paidAmountMinor: 0,
} as unknown as ObligationInstance

const accounts = [
  { id: 'account-cop', name: 'Bancolombia', type: 'bank', currency: 'COP' },
  { id: 'account-usd', name: 'Ahorros USD', type: 'savings', currency: 'USD' },
] as unknown as Account[]

const transactions = [
  {
    id: 'tx-1',
    type: 'expense',
    currency: 'COP',
    amountMinor: 1800000,
    description: 'Arriendo',
    occurredAt: '2026-09-01T00:00:00.000Z',
  },
] as unknown as Transaction[]

function renderForm(overrides: Partial<Parameters<typeof ReconcileForm>[0]> = {}) {
  return renderWithProviders(
    <ReconcileForm
      obligation={obligation}
      transactions={transactions}
      accounts={accounts}
      categories={[]}
      onSaved={vi.fn()}
      {...overrides}
    />,
  )
}

beforeEach(() => {
  vi.mocked(reconcileObligation).mockResolvedValue({
    data: { obligation },
  } as Awaited<ReturnType<typeof reconcileObligation>>)
})

/**
 * Settling a bill used to require the movement to exist already, so paying it
 * meant leaving the board, recording an expense, and coming back to find it.
 * Recording is therefore the default here; linking stays for the movement that
 * was already written down.
 */
describe('ReconcileForm', () => {
  it('opens on recording the payment, not on picking one', () => {
    renderForm()

    expect(screen.getByLabelText('Paid from')).toBeInTheDocument()
    expect(screen.queryByLabelText('Transaction')).not.toBeInTheDocument()
  })

  /**
   * A movement takes its account's currency, and only the obligation's own
   * currency can settle it — so an account in another one is a choice the
   * server would reject.
   */
  it('offers only accounts that could settle this obligation', () => {
    renderForm()

    const options = Array.from(
      screen.getByLabelText('Paid from').querySelectorAll('option'),
    ).map((option) => option.getAttribute('value'))

    expect(options).toEqual(['account-cop'])
  })

  it('starts the amount at what is still owed', () => {
    renderForm()

    expect(screen.getByLabelText('Amount')).toHaveValue(1800000)
  })

  it('starts the amount at the remainder when something was already paid', () => {
    renderForm({
      obligation: { ...obligation, paidAmountMinor: 800000 } as ObligationInstance,
    })

    expect(screen.getByLabelText('Amount')).toHaveValue(1000000)
  })

  it('records the movement and settles the obligation in one request', async () => {
    renderForm()

    await userEvent.click(screen.getByRole('button', { name: 'Record and settle' }))

    expect(reconcileObligation).toHaveBeenCalledWith('obligation-1', {
      transaction: expect.objectContaining({
        accountId: 'account-cop',
        amountMinor: 1800000,
      }),
    })
  })

  it('never sends a type or a currency, which the API decides', async () => {
    renderForm()

    await userEvent.click(screen.getByRole('button', { name: 'Record and settle' }))

    const [, body] = vi.mocked(reconcileObligation).mock.calls[0]
    expect(body).not.toHaveProperty('transaction.type')
    expect(body).not.toHaveProperty('transaction.currency')
  })

  it('links an existing movement when the reader switches', async () => {
    renderForm()

    await userEvent.click(screen.getByRole('tab', { name: 'Link' }))
    await userEvent.click(screen.getByRole('button', { name: 'Mark as settled' }))

    expect(reconcileObligation).toHaveBeenCalledWith('obligation-1', {
      transactionId: 'tx-1',
    })
  })

  it('says so when there is nothing to link, without hiding the way to record', async () => {
    renderForm({ transactions: [] })

    await userEvent.click(screen.getByRole('tab', { name: 'Link' }))

    expect(screen.getByText(/No expense in COP/)).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Record' })).toBeInTheDocument()
  })

  /**
   * Without an account in the obligation's currency there is nothing to record
   * the payment into, and the form has to say why rather than offer an empty
   * picker.
   */
  it('explains when no account could hold this payment', () => {
    renderForm({ accounts: [accounts[1]] })

    expect(screen.getByText(/No account in COP/)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Record and settle' }),
    ).not.toBeInTheDocument()
  })
})
