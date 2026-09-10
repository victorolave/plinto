import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/render-with-providers'
import { LoanForm } from '../loan-form'
import type { Account } from '../../../accounts/services/accounts'

vi.mock('../../services/loans')
vi.mock('../../../accounts/services/accounts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../accounts/services/accounts')>()),
  createAccount: vi.fn(),
}))

import { recordLoan } from '../../services/loans'
import { createAccount } from '../../../accounts/services/accounts'

const mockedRecordLoan = vi.mocked(recordLoan)
const mockedCreateAccount = vi.mocked(createAccount)

const account = (overrides: Partial<Account> = {}): Account => ({
  id: 'acc-bank',
  tenantId: 'tenant-1',
  name: 'Bancolombia',
  type: 'bank',
  currency: 'COP',
  createdAt: '2026-01-01T00:00:00.000Z',
  archivedAt: null,
  ...overrides,
})

const lender = (overrides: Partial<Account> = {}): Account =>
  account({ id: 'acc-lineru', name: 'Lineru', type: 'debt', ...overrides })

const loanResult = {
  data: {
    transfer: { id: 'transfer-1' },
    debit: { id: 'tx-1' },
    credit: { id: 'tx-2' },
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedRecordLoan.mockResolvedValue(loanResult)
})

describe('LoanForm', () => {
  it('records a loan from the chosen lender into the chosen account', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <LoanForm accounts={[account(), lender()]} onSaved={vi.fn()} />,
    )

    await user.type(screen.getByLabelText(/amount received/i), '983000')
    await user.click(screen.getByRole('button', { name: /record loan/i }))

    await waitFor(() =>
      expect(mockedRecordLoan).toHaveBeenCalledWith(
        expect.objectContaining({
          lenderAccountId: 'acc-lineru',
          destinationAccountId: 'acc-bank',
          amountMinor: 983000,
        }),
      ),
    )
  })

  /**
   * COP has no minor unit, so 983000 pesos is 983000 minor units. The old
   * ×100 assumption would have sent 98,300,000 — a hundred times the loan.
   */
  it('scales the amount at the receiving account’s currency', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <LoanForm
        accounts={[account({ currency: 'USD' }), lender({ currency: 'USD' })]}
        onSaved={vi.fn()}
      />,
    )

    await user.type(screen.getByLabelText(/amount received/i), '1234.50')
    await user.click(screen.getByRole('button', { name: /record loan/i }))

    await waitFor(() =>
      expect(mockedRecordLoan).toHaveBeenCalledWith(
        expect.objectContaining({ amountMinor: 123450 }),
      ),
    )
  })

  /**
   * Nobody should have to prepare an account before recording a loan, so the
   * lender is created from inside this flow — in the receiving account's
   * currency, because the API requires both sides to agree.
   */
  it('creates the lender inline when it does not exist yet', async () => {
    const user = userEvent.setup()
    mockedCreateAccount.mockResolvedValue({ data: { account: lender() } })

    renderWithProviders(<LoanForm accounts={[account()]} onSaved={vi.fn()} />)

    await user.type(screen.getByLabelText(/lender name/i), 'Lineru')
    await user.type(screen.getByLabelText(/amount received/i), '983000')
    await user.click(screen.getByRole('button', { name: /record loan/i }))

    await waitFor(() =>
      expect(mockedCreateAccount).toHaveBeenCalledWith({
        name: 'Lineru',
        type: 'debt',
        currency: 'COP',
      }),
    )
    await waitFor(() =>
      expect(mockedRecordLoan).toHaveBeenCalledWith(
        expect.objectContaining({ lenderAccountId: 'acc-lineru' }),
      ),
    )
  })

  /**
   * Asserted by what does NOT happen rather than by an error message: the field
   * is `required`, so the browser blocks the submit before the handler runs and
   * the handler's own message never renders. The handler keeps its check
   * anyway — it is the one that still holds if the attribute is ever removed —
   * and what both guarantee is that nothing reaches the API.
   */
  it('creates nothing and records nothing when the new lender is unnamed', async () => {
    const user = userEvent.setup()
    renderWithProviders(<LoanForm accounts={[account()]} onSaved={vi.fn()} />)

    await user.type(screen.getByLabelText(/amount received/i), '983000')
    await user.click(screen.getByRole('button', { name: /record loan/i }))

    expect(mockedCreateAccount).not.toHaveBeenCalled()
    expect(mockedRecordLoan).not.toHaveBeenCalled()
  })

  /**
   * A loan landing in another debt is refinancing, which PRD-007 puts out of
   * scope and the API refuses. Not offering it beats a rejected request.
   */
  it('does not offer a liability as the receiving account', () => {
    renderWithProviders(
      <LoanForm accounts={[account(), lender()]} onSaved={vi.fn()} />,
    )

    const destination = screen.getByLabelText(/received into/i)
    expect(destination).toHaveTextContent('Bancolombia')
    expect(destination).not.toHaveTextContent('Lineru')
  })

  // The whole point of the slice, stated where a person will read it.
  it('says plainly that this is not income', () => {
    renderWithProviders(<LoanForm accounts={[account()]} onSaved={vi.fn()} />)

    expect(screen.getByText(/this is not income/i)).toBeInTheDocument()
  })

  it('surfaces the API refusing the loan', async () => {
    const user = userEvent.setup()
    mockedRecordLoan.mockRejectedValue(
      new Error('The lender and the receiving account must share a currency'),
    )

    renderWithProviders(
      <LoanForm accounts={[account(), lender()]} onSaved={vi.fn()} />,
    )

    await user.type(screen.getByLabelText(/amount received/i), '983000')
    await user.click(screen.getByRole('button', { name: /record loan/i }))

    expect(await screen.findByText(/must share a currency/i)).toBeInTheDocument()
  })
})
