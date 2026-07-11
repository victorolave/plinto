import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/render-with-providers'
import { TransactionRow } from '../transaction-row'
import type { Transaction } from '../../services/transactions'
import type { Account } from '../../../accounts/services/accounts'
import { formatOccurredAtDate } from '../../lib/transaction-input'
import { formatMoneyMagnitude } from '../../../../components/ui/amount'

const account: Account = {
  id: 'acc-1',
  tenantId: 'tenant-1',
  name: 'Main Checking',
  type: 'bank',
  currency: 'USD',
  createdAt: '2026-01-01T00:00:00.000Z',
  archivedAt: null,
}

const transaction: Transaction = {
  id: 'tx-1',
  tenantId: 'tenant-1',
  accountId: 'acc-1',
  type: 'expense',
  amountMinor: 4599,
  currency: 'USD',
  description: 'Coffee shop',
  occurredAt: '2026-01-15T00:00:00.000Z',
  createdAt: '2026-01-15T00:00:00.000Z',
}

describe('TransactionRow', () => {
  it('renders description, date, account, and signed amount', () => {
    renderWithProviders(
      <TransactionRow transaction={transaction} account={account} onEdit={vi.fn()} />,
    )

    expect(screen.getByText('Coffee shop')).toBeInTheDocument()
    expect(screen.getByText(formatOccurredAtDate(transaction.occurredAt))).toBeInTheDocument()
    expect(screen.getByText('Main Checking')).toBeInTheDocument()
    expect(
      screen.getByText(`−${formatMoneyMagnitude(transaction.amountMinor, transaction.currency)}`),
    ).toBeInTheDocument()
  })

  it('falls back to "Expense"/"Income" when there is no description', () => {
    renderWithProviders(
      <TransactionRow
        transaction={{ ...transaction, description: null }}
        account={account}
        onEdit={vi.fn()}
      />,
    )

    expect(screen.getByText('Expense')).toBeInTheDocument()
  })

  it('fires onEdit when the edit button is clicked', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()

    renderWithProviders(
      <TransactionRow transaction={transaction} account={account} onEdit={onEdit} />,
    )

    await user.click(screen.getByRole('button', { name: /edit/i }))
    expect(onEdit).toHaveBeenCalledTimes(1)
  })
})
