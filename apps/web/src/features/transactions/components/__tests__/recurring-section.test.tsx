import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RecurringSection } from '../recurring-section'
import type { RecurringTransactionRule } from '../../services/recurring-transactions'
import type { Account } from '../../../accounts/services/accounts'

const account: Account = {
  id: 'account-1',
  tenantId: 'tenant-1',
  name: 'Main account',
  type: 'bank',
  currency: 'COP',
  createdAt: '2026-01-01T00:00:00.000Z',
  archivedAt: null,
}

function buildRule(overrides: Partial<RecurringTransactionRule> = {}): RecurringTransactionRule {
  return {
    id: 'rule-1',
    tenantId: 'tenant-1',
    accountId: 'account-1',
    name: 'Rent',
    type: 'expense',
    amountMinor: 250000,
    currency: 'COP',
    frequency: 'monthly',
    dayOfMonth: 5,
    startDate: '2026-01-01T00:00:00.000Z',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function renderSection(rules: RecurringTransactionRule[]) {
  const handlers = {
    onAdd: vi.fn(),
    onEdit: vi.fn(),
    onPause: vi.fn(),
    onResume: vi.fn(),
    onArchive: vi.fn(),
    onRestore: vi.fn(),
  }

  render(
    <RecurringSection rules={rules} accounts={[account]} loading={false} {...handlers} />,
  )

  return handlers
}

describe('RecurringSection', () => {
  it('renders live rules with their lifecycle state', () => {
    renderSection([
      buildRule({ id: 'rule-1', name: 'Rent', status: 'active' }),
      buildRule({ id: 'rule-2', name: 'Gym', status: 'paused' }),
    ])

    expect(screen.getByText('Rent')).toBeInTheDocument()
    expect(screen.getByText('Gym')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Paused')).toBeInTheDocument()
  })

  // Archived rules are folded away, not dropped: the user must still be able
  // to find and restore them.
  it('hides archived rules behind a toggle', async () => {
    const user = userEvent.setup()
    renderSection([
      buildRule({ id: 'rule-1', name: 'Rent', status: 'active' }),
      buildRule({ id: 'rule-2', name: 'Old subscription', status: 'archived' }),
    ])

    expect(screen.queryByText('Old subscription')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /show archived \(1\)/i }))

    expect(screen.getByText('Old subscription')).toBeInTheDocument()
  })

  it('restores an archived rule through the archived list', async () => {
    const user = userEvent.setup()
    const handlers = renderSection([
      buildRule({ id: 'rule-2', name: 'Old subscription', status: 'archived' }),
    ])

    await user.click(screen.getByRole('button', { name: /show archived/i }))
    await user.click(screen.getByRole('button', { name: /restore/i }))

    expect(handlers.onRestore).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'rule-2' }),
    )
  })

  // The row action is the one that applies to the rule's current state —
  // offering both Pause and Resume at once would let a user ask for a
  // transition the API rejects.
  it('offers Pause for an active rule and Resume for a paused one', async () => {
    const user = userEvent.setup()
    const handlers = renderSection([buildRule({ status: 'active' })])

    await user.click(screen.getByRole('button', { name: /actions for rent/i }))

    expect(screen.queryByRole('menuitem', { name: /^resume$/i })).not.toBeInTheDocument()
    await user.click(screen.getByRole('menuitem', { name: /^pause$/i }))

    expect(handlers.onPause).toHaveBeenCalledWith(expect.objectContaining({ id: 'rule-1' }))
  })

  it('emits resume for a paused rule', async () => {
    const user = userEvent.setup()
    const handlers = renderSection([buildRule({ status: 'paused' })])

    await user.click(screen.getByRole('button', { name: /actions for rent/i }))
    await user.click(screen.getByRole('menuitem', { name: /^resume$/i }))

    expect(handlers.onResume).toHaveBeenCalledWith(expect.objectContaining({ id: 'rule-1' }))
    expect(handlers.onPause).not.toHaveBeenCalled()
  })

  it('emits archive from the row actions', async () => {
    const user = userEvent.setup()
    const handlers = renderSection([buildRule({ status: 'active' })])

    await user.click(screen.getByRole('button', { name: /actions for rent/i }))
    await user.click(screen.getByRole('menuitem', { name: /^archive$/i }))

    expect(handlers.onArchive).toHaveBeenCalledWith(expect.objectContaining({ id: 'rule-1' }))
  })

  it('shows the empty state when every rule is archived', () => {
    renderSection([buildRule({ status: 'archived' })])

    expect(screen.getByText(/no recurring rules yet/i)).toBeInTheDocument()
  })
})
