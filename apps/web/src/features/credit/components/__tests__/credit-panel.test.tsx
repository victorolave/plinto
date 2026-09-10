import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/render-with-providers'
import { money } from '../../../../test/money'
import { CreditPanel } from '../credit-panel'
import type { CreditLineStatement, CreditLineWithLatest } from '../../services/credit'

vi.mock('../../services/credit')
vi.mock('../../../accounts/services/accounts')

import {
  closeCreditLine,
  getCreditSummary,
  updateCreditLine,
  updateStatement,
} from '../../services/credit'
import { listAccounts } from '../../../accounts/services/accounts'

const mockedSummary = vi.mocked(getCreditSummary)
const mockedClose = vi.mocked(closeCreditLine)
const mockedUpdate = vi.mocked(updateStatement)
const mockedUpdateLine = vi.mocked(updateCreditLine)
const mockedListAccounts = vi.mocked(listAccounts)

/**
 * The period the panel will read as "current".
 *
 * Computed against the real clock rather than frozen with fake timers: those
 * stall the timers React Query and `findBy*` run on, and every assertion here
 * would sit until it timed out. Only `period` is compared to today — the dates
 * below are display-only, so they can stay fixed.
 */
const thisPeriod = (): string => {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

const statement = (
  overrides: Partial<CreditLineStatement> = {},
): CreditLineStatement => ({
  id: 'stmt-1',
  tenantId: 'tenant-1',
  creditLineId: 'line-addi',
  period: thisPeriod(),
  cutoffDate: '2026-08-12T00:00:00.000Z',
  dueDate: '2026-08-20T00:00:00.000Z',
  closingBalanceMinor: 800000,
  amountDueMinor: 300000,
  limitMinorSnapshot: 1200000,
  currency: 'COP',
  createdAt: '2026-08-12T00:00:00.000Z',
  availableMinor: 400000,
  ...overrides,
})

const line = (
  overrides: Partial<CreditLineWithLatest> = {},
): CreditLineWithLatest => ({
  id: 'line-addi',
  tenantId: 'tenant-1',
  name: 'ADDI',
  limitMinor: 1200000,
  currency: 'COP',
  status: 'active',
  createdAt: '2026-07-01T00:00:00.000Z',
  latestStatement: statement(),
  availableMinor: 400000,
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  mockedListAccounts.mockResolvedValue({ data: { accounts: [] } })
  mockedSummary.mockResolvedValue({ data: { creditLines: [] } })
  mockedClose.mockResolvedValue({ data: { creditLine: line({ status: 'closed' }) } })
  mockedUpdate.mockResolvedValue({ data: { statement: statement() } })
  mockedUpdateLine.mockResolvedValue({ data: { creditLine: line() } })
})

describe('CreditPanel', () => {
  it('shows the payment due, the room left, and when it falls due', async () => {
    mockedSummary.mockResolvedValue({ data: { creditLines: [line()] } })

    renderWithProviders(<CreditPanel />)

    const open = within(await screen.findByRole('list', { name: /open/i }))
    expect(open.getByText('ADDI')).toBeInTheDocument()
    expect(open.getByText(money(300000, 'COP'))).toBeInTheDocument()
    expect(open.getByText(/available of/)).toBeInTheDocument()
    // Matched on the row rather than a text node: the line is assembled from
    // several spans. The day is asserted without pinning month-name order,
    // which `toLocaleDateString` decides from the runtime locale.
    expect(open.getByRole('listitem')).toHaveTextContent(/due .*20/)
  })

  /**
   * The honesty of this panel. An old figure shown without its date reads as
   * current, and the household would pay last month's amount. Nothing is
   * projected — the line reports what it last heard, and says when it heard it.
   */
  it('flags a line whose current statement has not arrived, and dates the figure', async () => {
    mockedSummary.mockResolvedValue({
      data: {
        // Any period that is not the current one: the statement for this month
        // has not been entered.
        creditLines: [line({ latestStatement: statement({ period: '2020-01' }) })],
      },
    })

    renderWithProviders(<CreditPanel />)

    const open = within(await screen.findByRole('list', { name: /open/i }))
    expect(open.getByText('estimated')).toBeInTheDocument()
    expect(open.getByRole('listitem')).toHaveTextContent(/last statement .*12/)
    expect(open.getByText('Last paid')).toBeInTheDocument()
  })

  /**
   * Zero available and zero owed is a claim. "Not known yet" is the truth, and
   * the two must not look the same.
   */
  it('does not invent zeros for a line with no statement yet', async () => {
    mockedSummary.mockResolvedValue({
      data: {
        creditLines: [line({ latestStatement: null, availableMinor: null })],
      },
    })

    renderWithProviders(<CreditPanel />)

    const open = within(await screen.findByRole('list', { name: /open/i }))
    expect(open.getByText(/waiting for the first statement/)).toBeInTheDocument()
    expect(open.getByText('—')).toBeInTheDocument()
    expect(open.queryByText(money(0, 'COP'))).not.toBeInTheDocument()
  })

  it('totals what is owed and what is left across active lines', async () => {
    mockedSummary.mockResolvedValue({
      data: {
        creditLines: [
          line(),
          line({
            id: 'line-visa',
            name: 'Visa',
            limitMinor: 5000000,
            latestStatement: statement({
              id: 'stmt-2',
              creditLineId: 'line-visa',
              closingBalanceMinor: 3760000,
              amountDueMinor: 1240000,
              limitMinorSnapshot: 5000000,
              availableMinor: 1240000,
            }),
            availableMinor: 1240000,
          }),
        ],
      },
    })

    renderWithProviders(<CreditPanel />)

    expect(await screen.findByText(money(4560000, 'COP'))).toBeInTheDocument()
    expect(screen.getByText(/still available/)).toBeInTheDocument()
  })

  // A line without a statement is not known to owe nothing, so it contributes
  // nothing rather than zero.
  it('leaves a statement-less line out of the totals', async () => {
    mockedSummary.mockResolvedValue({
      data: {
        creditLines: [line(), line({ id: 'line-new', latestStatement: null, availableMinor: null })],
      },
    })

    renderWithProviders(<CreditPanel />)

    expect(await screen.findByText(money(800000, 'COP'))).toBeInTheDocument()
  })

  it('separates closed lines from open ones', async () => {
    mockedSummary.mockResolvedValue({
      data: {
        creditLines: [line({ id: 'line-old', name: 'Old card', status: 'closed' })],
      },
    })

    renderWithProviders(<CreditPanel />)

    const closed = within(await screen.findByRole('list', { name: /closed/i }))
    expect(closed.getByText('Old card')).toBeInTheDocument()
    expect(closed.getByText('closed')).toBeInTheDocument()
    // Nothing to record against a line that issues nothing.
    expect(closed.queryByRole('button', { name: /add statement/i })).not.toBeInTheDocument()
  })

  it('invites a first line when the household has none', async () => {
    renderWithProviders(<CreditPanel />)

    expect(
      await screen.findByText(/no cards or rotating lines yet/i),
    ).toBeInTheDocument()
  })

  /**
   * The advice is to enter a statement when it arrives, and then its figures
   * are right by construction. But a household that enters one early, or
   * mistypes a zero, must not be stuck with the number: a system that stays
   * correct only while its user keeps perfect discipline will be wrong.
   */
  it('offers to fix the statement already recorded', async () => {
    mockedSummary.mockResolvedValue({ data: { creditLines: [line()] } })

    renderWithProviders(<CreditPanel />)

    const open = within(await screen.findByRole('list', { name: /open/i }))
    expect(open.getByRole('button', { name: /edit addi statement/i })).toBeInTheDocument()
  })

  it('offers nothing to fix on a line that has no statement yet', async () => {
    mockedSummary.mockResolvedValue({
      data: { creditLines: [line({ latestStatement: null, availableMinor: null })] },
    })

    renderWithProviders(<CreditPanel />)

    const open = within(await screen.findByRole('list', { name: /open/i }))
    // Scoped to the statement edit: the line's own name is an edit affordance
    // too, and that one is offered whether a statement exists or not.
    expect(
      open.queryByRole('button', { name: /edit .* statement/i }),
    ).not.toBeInTheDocument()
    expect(open.getByRole('button', { name: /add statement/i })).toBeInTheDocument()
  })

  // The cutoff decides which month the obligation belongs to, so editing it
  // would move the obligation between months.
  it('opens the fix drawer with the cutoff locked and the figures filled in', async () => {
    const user = userEvent.setup()
    mockedSummary.mockResolvedValue({ data: { creditLines: [line()] } })

    renderWithProviders(<CreditPanel />)

    const open = within(await screen.findByRole('list', { name: /open/i }))
    await user.click(open.getByRole('button', { name: /edit addi statement/i }))

    expect(await screen.findByLabelText(/statement date/i)).toBeDisabled()
    // COP carries no centavos (exponent 0), so major and minor units coincide.
    expect(screen.getByLabelText(/total owed/i)).toHaveValue(800000)
    expect(screen.getByLabelText(/to pay this month/i)).toHaveValue(300000)
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
  })

  it('sends only the corrected figures, never the cutoff', async () => {
    const user = userEvent.setup()
    mockedSummary.mockResolvedValue({ data: { creditLines: [line()] } })
    mockedUpdate.mockResolvedValue({
      data: { statement: statement({ amountDueMinor: 700000 }) },
    })

    renderWithProviders(<CreditPanel />)

    const open = within(await screen.findByRole('list', { name: /open/i }))
    await user.click(open.getByRole('button', { name: /edit addi statement/i }))

    const amount = await screen.findByLabelText(/to pay this month/i)
    await user.clear(amount)
    await user.type(amount, '700000')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(mockedUpdate).toHaveBeenCalledWith(
        'line-addi',
        'stmt-1',
        expect.objectContaining({ amountDueMinor: 700000 }),
      )
    })
    expect(mockedUpdate.mock.calls[0]?.[2]).not.toHaveProperty('cutoffDate')
  })

  /**
   * A ceiling set from memory, or moved by the issuer, has to be correctable.
   * Same reasoning as correcting a statement: a number nobody can fix is a
   * number its owner is stuck with.
   */
  it('moves a line’s ceiling from its name, without touching the currency', async () => {
    const user = userEvent.setup()
    mockedSummary.mockResolvedValue({ data: { creditLines: [line()] } })

    renderWithProviders(<CreditPanel />)

    const open = within(await screen.findByRole('list', { name: /open/i }))
    await user.click(open.getByRole('button', { name: /edit addi limit/i }))

    const limit = await screen.findByLabelText(/credit limit/i)
    expect(limit).toHaveValue(1200000)
    expect(screen.getByLabelText(/currency/i)).toBeDisabled()

    await user.clear(limit)
    await user.type(limit, '2000000')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(mockedUpdateLine).toHaveBeenCalledWith('line-addi', {
        name: 'ADDI',
        limitMinor: 2000000,
      })
    })
    expect(mockedUpdateLine.mock.calls[0]?.[1]).not.toHaveProperty('currency')
  })

  it('offers no ceiling edit on a closed line', async () => {
    mockedSummary.mockResolvedValue({
      data: { creditLines: [line({ status: 'closed' })] },
    })

    renderWithProviders(<CreditPanel />)

    const closed = within(await screen.findByRole('list', { name: /closed/i }))
    expect(closed.queryByRole('button', { name: /limit/i })).not.toBeInTheDocument()
  })

  it('refuses a payment larger than the balance before calling the server', async () => {
    const user = userEvent.setup()
    mockedSummary.mockResolvedValue({ data: { creditLines: [line()] } })

    renderWithProviders(<CreditPanel />)

    const open = within(await screen.findByRole('list', { name: /open/i }))
    await user.click(open.getByRole('button', { name: /edit addi statement/i }))

    const amount = await screen.findByLabelText(/to pay this month/i)
    await user.clear(amount)
    // Above the 800.000 the statement declares owed.
    await user.type(amount, '900000')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    expect(
      await screen.findByText(/amount due cannot exceed the closing balance/i),
    ).toBeInTheDocument()
    expect(mockedUpdate).not.toHaveBeenCalled()
  })
})
