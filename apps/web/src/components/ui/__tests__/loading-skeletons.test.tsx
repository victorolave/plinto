import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test/render-with-providers'
import { CreditPanel } from '../../../features/credit/components/credit-panel'
import { DebtsPanel } from '../../../features/debts/components/debts-panel'
import { DashboardOverview } from '../../../features/dashboard/components/dashboard-overview'

vi.mock('../../../features/credit/services/credit')
vi.mock('../../../features/debts/services/debts')
vi.mock('../../../features/accounts/services/accounts')
vi.mock('../../../features/transactions/services/transactions')
vi.mock('../../../components/layout/dashboard-context', () => ({
  useDashboard: () => ({ activeTenantName: 'Olaves' }),
}))
// DashboardOverview calls `useRouter` for its "See all" / "Manage" buttons,
// which throws outside a real App Router tree.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

import { getCreditSummary } from '../../../features/credit/services/credit'
import { getDebtSummary, listDebts } from '../../../features/debts/services/debts'
import { listAccounts } from '../../../features/accounts/services/accounts'
import {
  listBalances,
  listTransactions,
} from '../../../features/transactions/services/transactions'

/**
 * These three screens shipped without skeletons: credit and debts rendered a
 * bare "Loading…" label on an otherwise empty page, and the dashboard replaced
 * its whole body with one line of text.
 *
 * Nothing in the suite noticed, because every other test resolves its mocks
 * immediately and asserts on the loaded state. These assert on the state
 * *before* that — a request that never settles — which is the only way the
 * regression stays fixed.
 */

/** A promise that never resolves, so the panel stays in its loading branch. */
const pending = <T,>(): Promise<T> => new Promise<T>(() => {})

beforeEach(() => {
  vi.mocked(getCreditSummary).mockImplementation(pending)
  vi.mocked(getDebtSummary).mockImplementation(pending)
  vi.mocked(listDebts).mockImplementation(pending)
  vi.mocked(listAccounts).mockImplementation(pending)
  vi.mocked(listBalances).mockImplementation(pending)
  vi.mocked(listTransactions).mockImplementation(pending)
})

describe('loading skeletons', () => {
  it('shows a skeleton on the credit page while it loads', async () => {
    renderWithProviders(<CreditPanel />)

    expect(await screen.findByRole('status', { name: /loading credit/i })).toBeInTheDocument()
    // The placeholder replaces the word, it does not sit beside it.
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
  })

  it('shows a skeleton on the debts page while it loads', async () => {
    renderWithProviders(<DebtsPanel />)

    expect(await screen.findByRole('status', { name: /loading debts/i })).toBeInTheDocument()
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
  })

  it('shows a skeleton on the dashboard instead of a bare line of text', async () => {
    renderWithProviders(<DashboardOverview />)

    expect(
      await screen.findByRole('status', { name: /loading your household/i }),
    ).toBeInTheDocument()
    // The old behaviour: the entire page body collapsed to this paragraph.
    expect(screen.queryByText('Loading your household…')).not.toBeInTheDocument()
  })

  it('renders shimmer elements, not just an empty announced region', async () => {
    const { container } = renderWithProviders(<DashboardOverview />)

    await screen.findByRole('status', { name: /loading your household/i })
    expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(0)
  })
})
