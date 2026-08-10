import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/render-with-providers'
import { AccountCard } from '../account-card'
import type { Account } from '../../services/accounts'
import type { AccountBalance } from '../../../transactions/services/transactions'
import { money } from '../../../../test/money'

const account: Account = {
  id: 'acc-1',
  tenantId: 'tenant-1',
  name: 'Main Checking',
  type: 'bank',
  currency: 'USD',
  createdAt: '2026-01-01T00:00:00.000Z',
  archivedAt: null,
}

const balance: AccountBalance = {
  accountId: 'acc-1',
  accountName: 'Main Checking',
  currency: 'USD',
  balanceMinor: 123456,
}

describe('AccountCard', () => {
  it('shows the account name and formatted balance', () => {
    renderWithProviders(
      <AccountCard account={account} balance={balance} onEdit={vi.fn()} onArchive={vi.fn()} />,
    )

    expect(screen.getByText('Main Checking')).toBeInTheDocument()
    expect(
      screen.getByText(money(balance.balanceMinor, balance.currency)),
    ).toBeInTheDocument()
  })

  it('renders a zero balance when no balance is provided', () => {
    renderWithProviders(
      <AccountCard account={account} balance={undefined} onEdit={vi.fn()} onArchive={vi.fn()} />,
    )

    expect(screen.getByText(money(0, account.currency))).toBeInTheDocument()
  })

  it('fires onEdit and onArchive through the actions menu', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    const onArchive = vi.fn()

    renderWithProviders(
      <AccountCard account={account} balance={balance} onEdit={onEdit} onArchive={onArchive} />,
    )

    await user.click(screen.getByRole('button', { name: /account actions/i }))
    await user.click(await screen.findByRole('menuitem', { name: /edit/i }))
    expect(onEdit).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: /account actions/i }))
    await user.click(await screen.findByRole('menuitem', { name: /archive/i }))
    expect(onArchive).toHaveBeenCalledTimes(1)
  })
})
