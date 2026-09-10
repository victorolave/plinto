import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/render-with-providers'
import { AccountCard } from '../../features/accounts/components/account-card'
import { Amount } from '../../components/ui/amount'
import type { Account } from '../../features/accounts/services/accounts'
import type { AccountBalance } from '../../features/transactions/services/transactions'

/**
 * The rest of the component suite renders in English on purpose (see
 * `renderWithProviders`), which would leave the language real users actually
 * see untested. This file closes that gap deliberately rather than by accident.
 *
 * It is not a translation review — nothing here asserts that a given Spanish
 * sentence is well written. It asserts the two things that break silently:
 *   1. the catalogue is actually reached, so the UI is not rendering key paths;
 *   2. money follows the locale, so `es` gets Colombian separators.
 */

const account: Account = {
  id: 'account-1',
  tenantId: 'tenant-1',
  name: 'Cuenta familiar',
  type: 'bank',
  currency: 'COP',
  createdAt: '2026-01-01T00:00:00.000Z',
  archivedAt: null,
}

const balance: AccountBalance = {
  accountId: 'account-1',
  accountName: 'Cuenta familiar',
  accountType: 'bank',
  currency: 'COP',
  balanceMinor: 2300000,
}

describe('rendering in Spanish', () => {
  it('renders interface copy from the Spanish catalogue', () => {
    renderWithProviders(
      <AccountCard
        account={account}
        balance={balance}
        onEdit={vi.fn()}
        onArchive={vi.fn()}
      />,
      { locale: 'es' },
    )

    // The card's own label, and the account type — which used to be printed
    // as the raw enum value (`bank`).
    expect(screen.getByText('Saldo')).toBeInTheDocument()
    expect(screen.getByText('Banco')).toBeInTheDocument()
  })

  it('formats money with Colombian separators, not English ones', () => {
    renderWithProviders(<Amount minor={2300000} currency="COP" />, { locale: 'es' })

    // es-CO groups with `.`; en-US would render `2,300,000` here. This is the
    // assertion that would have caught `Intl.NumberFormat(undefined, …)`
    // silently following the runtime instead of the request.
    const rendered = screen.getByText(/2\.300\.000/)
    expect(rendered).toBeInTheDocument()
    expect(rendered.textContent).not.toContain('2,300,000')
  })

  it('renders the same component differently per locale', () => {
    const { unmount } = renderWithProviders(<Amount minor={2300000} currency="COP" />, {
      locale: 'es',
    })
    const spanish = screen.getByText(/2/).textContent
    unmount()

    renderWithProviders(<Amount minor={2300000} currency="COP" />, { locale: 'en' })
    const english = screen.getByText(/2/).textContent

    // The point of the whole exercise: locale is an input, not ambient state.
    expect(spanish).not.toBe(english)
  })
})
