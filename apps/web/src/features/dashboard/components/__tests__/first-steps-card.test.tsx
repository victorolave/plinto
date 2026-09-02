import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createTestQueryClient, renderWithProviders } from '../../../../test/render-with-providers'
import { FirstStepsCard } from '../first-steps-card'
import { queryKeys } from '../../../../lib/api/query-keys'
import type { Account } from '../../../accounts/services/accounts'
import type { ObligationInstance } from '../../../obligations/services/obligations'
import type { CreditLine } from '../../../credit/services/credit'
import type { TenantMember } from '../../../members/services/members'

vi.mock('../../../accounts/services/accounts')
vi.mock('../../../transactions/services/transactions')
vi.mock('../../../obligations/services/obligations')
vi.mock('../../../credit/services/credit')
vi.mock('../../../members/services/members')
vi.mock('../../../../components/layout/dashboard-context', () => ({
  useDashboard: () => ({ activeTenantId: 'tenant-1' }),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

import { listAccounts } from '../../../accounts/services/accounts'
import { listTransactions } from '../../../transactions/services/transactions'
import { listObligations } from '../../../obligations/services/obligations'
import { listCreditLines } from '../../../credit/services/credit'
import { listMembers } from '../../../members/services/members'

const mockedListAccounts = vi.mocked(listAccounts)
const mockedListTransactions = vi.mocked(listTransactions)
const mockedListObligations = vi.mocked(listObligations)
const mockedListCreditLines = vi.mocked(listCreditLines)
const mockedListMembers = vi.mocked(listMembers)

const account: Account = {
  id: 'acc-1',
  tenantId: 'tenant-1',
  name: 'Main',
  type: 'bank',
  currency: 'USD',
  createdAt: '2026-01-01T00:00:00.000Z',
  archivedAt: null,
}

const obligation = {} as ObligationInstance
const creditLine = {} as CreditLine

const member = (overrides: Partial<TenantMember> = {}): TenantMember => ({
  userId: 'user-1',
  email: 'victor@example.com',
  name: 'Victor',
  role: 'owner',
  joinedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

/** Resolves every dependency with the given completion counts. */
function mockAllResolved({
  accounts = 0,
  transactionsTotal = 0,
  obligations = 0,
  creditLines = 0,
  members = 1,
}: {
  accounts?: number
  transactionsTotal?: number
  obligations?: number
  creditLines?: number
  members?: number
} = {}) {
  mockedListAccounts.mockResolvedValue({
    data: { accounts: Array.from({ length: accounts }, () => account) },
  })
  mockedListTransactions.mockResolvedValue({
    data: { transactions: [] },
    meta: { pagination: { page: 1, pageSize: 1, total: transactionsTotal, totalPages: 1 } },
  })
  mockedListObligations.mockResolvedValue({
    data: { obligations: Array.from({ length: obligations }, () => obligation) },
  })
  mockedListCreditLines.mockResolvedValue({
    data: { creditLines: Array.from({ length: creditLines }, () => creditLine) },
  })
  mockedListMembers.mockResolvedValue({
    data: {
      members:
        members === 1
          ? [member()]
          : Array.from({ length: members }, (_, index) =>
              member({ userId: `user-${index}`, email: `user-${index}@example.com` }),
            ),
    },
  })
}

/** A promise that never resolves, so the query it backs stays in `isLoading`. */
const pending = <T,>(): Promise<T> => new Promise<T>(() => {})

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
})

describe('FirstStepsCard', () => {
  it('renders a skeleton placeholder, not nothing, while any query is loading', () => {
    mockedListAccounts.mockImplementation(pending)
    mockedListTransactions.mockResolvedValue({
      data: { transactions: [] },
      meta: { pagination: { page: 1, pageSize: 1, total: 0, totalPages: 1 } },
    })
    mockedListObligations.mockResolvedValue({ data: { obligations: [] } })
    mockedListCreditLines.mockResolvedValue({ data: { creditLines: [] } })
    mockedListMembers.mockResolvedValue({ data: { members: [member()] } })

    renderWithProviders(<FirstStepsCard />)

    // The real title never renders as text while loading (the heading is a
    // shimmer bar, not the translated string) — but the card still occupies
    // its own announced region instead of vanishing outright.
    expect(screen.queryByText('First steps')).not.toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'First steps' })).toBeInTheDocument()
  })

  it('renders nothing when a query errors', async () => {
    mockAllResolved()
    mockedListAccounts.mockRejectedValue(new Error('boom'))
    const queryClient = createTestQueryClient()

    renderWithProviders(<FirstStepsCard />, { queryClient })

    await waitFor(() =>
      expect(queryClient.getQueryState(queryKeys.accounts())?.status).toBe('error'),
    )
    expect(screen.queryByText('First steps')).not.toBeInTheDocument()
  })

  it('shows all five steps unchecked when nothing is set up yet', async () => {
    mockAllResolved({ members: 1 })

    renderWithProviders(<FirstStepsCard />)

    expect(await screen.findByText('First steps')).toBeInTheDocument()
    expect(screen.getByText('Tell Plinto where your money is')).toBeInTheDocument()
    expect(screen.getByText('Record your first transaction')).toBeInTheDocument()
    expect(screen.getByText('Note what you owe this month')).toBeInTheDocument()
    expect(screen.getByText('Add a card or revolving credit line')).toBeInTheDocument()
    expect(screen.getByText('Invite whoever shares the expenses')).toBeInTheDocument()
  })

  it('tags its root with data-tour so the product tour can anchor to it', async () => {
    mockAllResolved({ members: 1 })

    renderWithProviders(<FirstStepsCard />)

    expect(await screen.findByText('First steps')).toBeInTheDocument()
    expect(document.querySelector('[data-tour="first-steps"]')).not.toBeNull()
  })

  it('checks off only the steps that are actually complete', async () => {
    mockAllResolved({ accounts: 1, transactionsTotal: 3, members: 1 })

    renderWithProviders(<FirstStepsCard />)

    await screen.findByText('First steps')

    // Two steps done (accounts, transactions), three still pending: the
    // pending labels keep their plain "link-button" class, the done ones pick
    // up "muted" — that distinction is the whole visible signal here.
    const accountsStep = screen.getByText('Tell Plinto where your money is')
    const obligationsStep = screen.getByText('Note what you owe this month')
    expect(accountsStep.className).toContain('muted')
    expect(obligationsStep.className).not.toContain('muted')
  })

  it('renders nothing once every step is complete', async () => {
    mockAllResolved({
      accounts: 1,
      transactionsTotal: 1,
      obligations: 1,
      creditLines: 1,
      members: 2,
    })
    const queryClient = createTestQueryClient()

    renderWithProviders(<FirstStepsCard />, { queryClient })

    await waitFor(() =>
      expect(queryClient.getQueryState(queryKeys.members)?.status).toBe('success'),
    )
    expect(screen.queryByText('First steps')).not.toBeInTheDocument()
  })

  it('tells its parent it is visible once it shows real content', async () => {
    mockAllResolved({ accounts: 1, transactionsTotal: 3, members: 1 })
    const onVisibilityChange = vi.fn()

    renderWithProviders(<FirstStepsCard onVisibilityChange={onVisibilityChange} />)

    await screen.findByText('First steps')

    expect(onVisibilityChange).toHaveBeenCalledWith(true)
  })

  it('tells its parent it is not visible once every step is complete', async () => {
    mockAllResolved({
      accounts: 1,
      transactionsTotal: 1,
      obligations: 1,
      creditLines: 1,
      members: 2,
    })
    const onVisibilityChange = vi.fn()
    const queryClient = createTestQueryClient()

    renderWithProviders(<FirstStepsCard onVisibilityChange={onVisibilityChange} />, {
      queryClient,
    })

    await waitFor(() =>
      expect(queryClient.getQueryState(queryKeys.members)?.status).toBe('success'),
    )
    expect(onVisibilityChange).toHaveBeenCalledWith(false)
  })

  it('hides the card and remembers the choice per tenant', async () => {
    mockAllResolved()
    const user = userEvent.setup()

    renderWithProviders(<FirstStepsCard />)

    await screen.findByText('First steps')
    await user.click(screen.getByRole('button', { name: 'Hide' }))

    expect(screen.queryByText('First steps')).not.toBeInTheDocument()
    expect(window.localStorage.getItem('plinto.dashboard.firstSteps.hidden.tenant-1')).toBe(
      '1',
    )
  })

  it('stays hidden on a fresh render once the tenant already dismissed it', () => {
    window.localStorage.setItem('plinto.dashboard.firstSteps.hidden.tenant-1', '1')
    mockAllResolved()

    renderWithProviders(<FirstStepsCard />)

    expect(screen.queryByText('First steps')).not.toBeInTheDocument()
  })

  it('never calls any of its services when the tenant already dismissed the card', () => {
    // `enabled: !hidden` on every query is the point of this test: reading the
    // dismissal from localStorage happens synchronously in the `useState`
    // initializer, so not one of these five services should fire — not even
    // once, and not eventually.
    window.localStorage.setItem('plinto.dashboard.firstSteps.hidden.tenant-1', '1')
    mockAllResolved()

    renderWithProviders(<FirstStepsCard />)

    expect(mockedListAccounts).not.toHaveBeenCalled()
    expect(mockedListTransactions).not.toHaveBeenCalled()
    expect(mockedListObligations).not.toHaveBeenCalled()
    expect(mockedListCreditLines).not.toHaveBeenCalled()
    expect(mockedListMembers).not.toHaveBeenCalled()
  })
})
