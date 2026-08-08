import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/render-with-providers'
import { ObligationsPanel } from '../obligations-panel'
import type { ObligationInstance } from '../../services/obligations'

vi.mock('../../services/obligations')
vi.mock('../../../transactions/services/transactions')
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

import {
  getObligationSummary,
  listObligations,
  removeObligationPayment,
} from '../../services/obligations'
import { listTransactions } from '../../../transactions/services/transactions'

const mockedList = vi.mocked(listObligations)
const mockedSummary = vi.mocked(getObligationSummary)
const mockedTransactions = vi.mocked(listTransactions)
const mockedRemovePayment = vi.mocked(removeObligationPayment)

function buildObligation(
  overrides: Partial<ObligationInstance> = {},
): ObligationInstance {
  return {
    id: 'obligation-1',
    tenantId: 'tenant-1',
    sourceType: 'recurring_rule',
    recurringRuleId: 'rule-1',
    period: '2026-07',
    dueDate: '2026-07-05T00:00:00.000Z',
    name: 'Rent',
    expectedAmountMinor: 230000,
    currency: 'COP',
    status: 'pending',
    paidAmountMinor: 0,
    outstandingAmountMinor: 230000,
    payments: [],
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedTransactions.mockResolvedValue({
    data: { transactions: [] },
    meta: { pagination: { total: 0 } },
  } as any)
  mockedSummary.mockResolvedValue({
    data: { summary: { period: '2026-07', totals: [] } },
  })
  mockedList.mockResolvedValue({ data: { obligations: [] } })
})

describe('ObligationsPanel', () => {
  it('shows a loading state before the board resolves', () => {
    mockedList.mockReturnValue(new Promise(() => {}))

    renderWithProviders(<ObligationsPanel />)

    expect(screen.getByRole('status', { name: /loading obligations/i })).toBeInTheDocument()
  })

  it('renders the obligations of the period with their derived status', async () => {
    mockedList.mockResolvedValue({
      data: {
        obligations: [
          buildObligation({ id: 'o-1', name: 'Rent', status: 'overdue' }),
          buildObligation({ id: 'o-2', name: 'Utilities', status: 'paid' }),
        ],
      },
    })

    renderWithProviders(<ObligationsPanel />)

    expect(await screen.findByText('Rent')).toBeInTheDocument()
    expect(screen.getByText('Utilities')).toBeInTheDocument()
    expect(screen.getByText('Overdue')).toBeInTheDocument()
    expect(screen.getByText('Paid')).toBeInTheDocument()
  })

  // One block per currency, never a combined figure.
  it('renders period totals per currency', async () => {
    mockedSummary.mockResolvedValue({
      data: {
        summary: {
          period: '2026-07',
          totals: [
            {
              currency: 'COP',
              expectedMinor: 330000,
              paidMinor: 250000,
              outstandingMinor: 100000,
            },
            {
              currency: 'USD',
              expectedMinor: 50000,
              paidMinor: 0,
              outstandingMinor: 50000,
            },
          ],
        },
      },
    })

    renderWithProviders(<ObligationsPanel />)

    await waitFor(() => {
      expect(screen.getAllByText('Outstanding')).toHaveLength(2)
    })
    expect(screen.getAllByText('Total')).toHaveLength(2)
    expect(screen.getAllByText('Paid')).toHaveLength(2)
  })

  // The outstanding figure comes from the server precisely so an overpayment
  // on one obligation cannot absorb the shortfall of another.
  it('shows the outstanding total the server reported, not expected minus paid', async () => {
    mockedSummary.mockResolvedValue({
      data: {
        summary: {
          period: '2026-07',
          totals: [
            {
              currency: 'COP',
              expectedMinor: 330000,
              paidMinor: 250000,
              outstandingMinor: 100000,
            },
          ],
        },
      },
    })

    renderWithProviders(<ObligationsPanel />)

    // 100000 minor units, not the 80000 a subtraction would produce.
    expect(await screen.findByText(/1,000\.00/)).toBeInTheDocument()
    expect(screen.queryByText(/800\.00/)).not.toBeInTheDocument()
  })

  it('shows an empty state for a month with nothing due', async () => {
    renderWithProviders(<ObligationsPanel />)

    expect(await screen.findByText(/nothing due in/i)).toBeInTheDocument()
  })

  it('moves between months and refetches for the new period', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ObligationsPanel />)

    await waitFor(() => expect(mockedList).toHaveBeenCalled())
    const firstPeriod = mockedList.mock.calls[0][0]

    await user.click(screen.getByRole('button', { name: /next month/i }))

    await waitFor(() => {
      const periods = mockedList.mock.calls.map(([period]) => period)
      expect(periods.some((period) => period !== firstPeriod)).toBe(true)
    })
  })

  it('unlinks a payment from the row actions', async () => {
    const user = userEvent.setup()
    mockedRemovePayment.mockResolvedValue({
      data: { obligation: buildObligation() },
    })
    mockedList.mockResolvedValue({
      data: {
        obligations: [
          buildObligation({
            status: 'paid',
            paidAmountMinor: 230000,
            payments: [
              {
                id: 'payment-1',
                transactionId: 'tx-abcdef12',
                amountMinor: 230000,
                currency: 'COP',
                occurredAt: '2026-07-05T00:00:00.000Z',
                createdAt: '2026-07-05T00:00:00.000Z',
              },
            ],
          }),
        ],
      },
    })

    renderWithProviders(<ObligationsPanel />)

    await user.click(await screen.findByRole('button', { name: /actions for rent/i }))
    await user.click(screen.getByRole('menuitem', { name: /unlink/i }))

    expect(mockedRemovePayment).toHaveBeenCalledWith('obligation-1', 'tx-abcdef12')
  })
})
