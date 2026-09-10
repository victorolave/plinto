import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/render-with-providers'
import { money } from '../../../../test/money'
import { DebtsPanel } from '../debts-panel'
import type { DebtSchedule } from '../../services/debts'

vi.mock('../../services/debts')
vi.mock('../../../accounts/services/accounts')

import { cancelDebt, getDebtSummary, listDebts } from '../../services/debts'
import { listAccounts } from '../../../accounts/services/accounts'

const mockedListDebts = vi.mocked(listDebts)
const mockedSummary = vi.mocked(getDebtSummary)
const mockedCancel = vi.mocked(cancelDebt)
const mockedListAccounts = vi.mocked(listAccounts)

const debt = (overrides: Partial<DebtSchedule> = {}): DebtSchedule => ({
  id: 'debt-1',
  tenantId: 'tenant-1',
  accountId: 'acc-addi',
  name: 'Nevera',
  principalMinor: 600000,
  installmentMinor: 100000,
  installmentCount: 6,
  firstDueDate: '2026-07-15T00:00:00.000Z',
  currency: 'COP',
  status: 'active',
  createdAt: '2026-07-01T00:00:00.000Z',
  paidMinor: 200000,
  outstandingMinor: 400000,
  settled: false,
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  mockedListAccounts.mockResolvedValue({ data: { accounts: [] } })
  mockedSummary.mockResolvedValue({ data: { summary: { totals: [] } } })
  mockedListDebts.mockResolvedValue({ data: { debts: [] } })
  mockedCancel.mockResolvedValue({ data: { debt: debt({ status: 'cancelled' }) } })
})

describe('DebtsPanel', () => {
  it('lists a plan with what is left on it', async () => {
    mockedListDebts.mockResolvedValue({ data: { debts: [debt()] } })

    renderWithProviders(<DebtsPanel />)

    const inProgress = within(await screen.findByRole('list', { name: /in progress/i }))
    expect(inProgress.getByText('Nevera')).toBeInTheDocument()
    expect(inProgress.getByText(money(400000, 'COP'))).toBeInTheDocument()
    expect(inProgress.getByText(/6 ×/)).toBeInTheDocument()
    expect(inProgress.getByText(/33% paid/)).toBeInTheDocument()
  })

  /**
   * The two figures are shown together but never merged into one headline.
   * Remaining instalments and what the lender accounts carry measure different
   * things, and a single number would quietly answer a question the model has
   * not decided.
   */
  it('breaks the total into instalments and lender balances', async () => {
    mockedSummary.mockResolvedValue({
      data: {
        summary: {
          totals: [
            {
              currency: 'COP',
              scheduledOutstandingMinor: 400000,
              lenderOwedMinor: 983000,
            },
          ],
        },
      },
    })

    renderWithProviders(<DebtsPanel />)

    expect(await screen.findByText(/in instalments/i)).toHaveTextContent(
      /on loans and cards/i,
    )
    expect(screen.getByText(money(1383000, 'COP'))).toBeInTheDocument()
  })

  it('separates finished plans from those still running', async () => {
    mockedListDebts.mockResolvedValue({
      data: {
        debts: [
          debt(),
          debt({ id: 'debt-2', name: 'Lavadora', settled: true, outstandingMinor: 0 }),
        ],
      },
    })

    renderWithProviders(<DebtsPanel />)

    const finished = within(await screen.findByRole('list', { name: /finished/i }))
    expect(finished.getByText('Lavadora')).toBeInTheDocument()
    expect(finished.getByText('settled')).toBeInTheDocument()

    const inProgress = within(screen.getByRole('list', { name: /in progress/i }))
    expect(inProgress.queryByText('Lavadora')).not.toBeInTheDocument()
  })

  it('offers no cancel on a plan that already finished', async () => {
    mockedListDebts.mockResolvedValue({
      data: { debts: [debt({ settled: true, outstandingMinor: 0 })] },
    })

    renderWithProviders(<DebtsPanel />)

    await screen.findByText('Nevera')
    expect(screen.queryByRole('button', { name: /cancel nevera/i })).not.toBeInTheDocument()
  })

  /**
   * Cancelling stops future instalments but keeps the ones already produced —
   * some of them paid. Saying so is what stops an owner hesitating over whether
   * it erases the history.
   */
  it('confirms before cancelling, and says what survives it', async () => {
    const user = userEvent.setup()
    mockedListDebts.mockResolvedValue({ data: { debts: [debt()] } })

    renderWithProviders(<DebtsPanel />)

    await user.click(await screen.findByRole('button', { name: /cancel nevera/i }))
    expect(screen.getByText(/the ones it already produced stay/i)).toBeInTheDocument()
    expect(mockedCancel).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /^cancel plan$/i }))

    await waitFor(() => expect(mockedCancel).toHaveBeenCalledWith('debt-1'))
  })

  it('explains what a debt is when there are none', async () => {
    renderWithProviders(<DebtsPanel />)

    expect(await screen.findByText(/nothing financed yet/i)).toBeInTheDocument()
    expect(
      screen.getByText(/a debt is a loan with fixed instalments/i),
    ).toBeInTheDocument()
  })

  it('surfaces a load failure instead of reporting no debt', async () => {
    mockedListDebts.mockRejectedValue(new Error('Network unreachable'))

    renderWithProviders(<DebtsPanel />)

    expect(await screen.findByText('Network unreachable')).toBeInTheDocument()
  })
})
