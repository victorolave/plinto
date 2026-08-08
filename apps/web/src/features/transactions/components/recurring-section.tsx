'use client'

import { useMemo, useState } from 'react'
import type { Account } from '../../accounts/services/accounts'
import type {
  RecurringRuleStatus,
  RecurringTransactionRule,
} from '../services/recurring-transactions'
import { Card, CardHeader } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Amount } from '../../../components/ui/amount'
import { Badge } from '../../../components/ui/badge'
import { ActionsMenu } from '../../../components/ui/actions-menu'
import { Pencil, Plus, Repeat, Trash, X } from '../../../components/ui/icons'
import { EmptyState } from '../../../components/ui/empty-state'
import { RecurringListSkeleton } from './transactions-skeleton'

const STATUS_LABEL: Record<RecurringRuleStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  archived: 'Archived',
}

// Paused is deliberately not `danger`: it is a normal, reversible user choice,
// not a fault state.
const STATUS_TONE: Record<RecurringRuleStatus, 'success' | 'warning' | 'neutral'> = {
  active: 'success',
  paused: 'warning',
  archived: 'neutral',
}

export interface RecurringSectionProps {
  rules: RecurringTransactionRule[]
  accounts: Account[]
  loading: boolean
  onAdd: () => void
  onEdit: (rule: RecurringTransactionRule) => void
  onPause: (rule: RecurringTransactionRule) => void
  onResume: (rule: RecurringTransactionRule) => void
  onArchive: (rule: RecurringTransactionRule) => void
  onRestore: (rule: RecurringTransactionRule) => void
}

/** Recurring rules with their lifecycle actions, on the main transactions view. */
export function RecurringSection({
  rules,
  accounts,
  loading,
  onAdd,
  onEdit,
  onPause,
  onResume,
  onArchive,
  onRestore,
}: RecurringSectionProps) {
  const accountById = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts],
  )
  const [showArchived, setShowArchived] = useState(false)

  // Archived rules are folded away behind a toggle, exactly as archived
  // accounts are: retired means out of the way, not gone.
  const liveRules = useMemo(
    () => rules.filter((rule) => rule.status !== 'archived'),
    [rules],
  )
  const archivedRules = useMemo(
    () => rules.filter((rule) => rule.status === 'archived'),
    [rules],
  )

  return (
    <Card flush>
      <div style={{ padding: 'var(--space-5) var(--space-5) 0' }}>
        <CardHeader
          title="Recurring transactions"
          subtitle="Rules that post automatically each month when due"
          action={
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Plus size={16} />}
              onClick={onAdd}
              disabled={accounts.length === 0}
            >
              New rule
            </Button>
          }
        />
      </div>
      <div className="data-list" style={{ padding: '0 var(--space-5) var(--space-3)' }}>
        {loading ? <RecurringListSkeleton /> : null}
        {!loading && liveRules.length === 0 ? (
          <EmptyState
            compact
            icon={<Repeat size={24} />}
            title="No recurring rules yet"
            description="Automate rent, salary or subscriptions — they post themselves each month when due."
          />
        ) : null}
        {liveRules.map((rule) => {
          const account = accountById.get(rule.accountId)
          const currency = rule.currency ?? account?.currency ?? ''
          const isPaused = rule.status === 'paused'
          return (
            <div key={rule.id} className="data-row">
              <div style={{ minWidth: 0 }}>
                <div className="account-name">{rule.name}</div>
                <div className="account-meta" style={{ textTransform: 'none' }}>
                  Day {rule.dayOfMonth} · {account?.name ?? 'account'}
                </div>
              </div>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}
              >
                {currency ? (
                  <Amount minor={rule.amountMinor} currency={currency} size="sm" />
                ) : null}
                <Badge tone={STATUS_TONE[rule.status]}>
                  {STATUS_LABEL[rule.status]}
                </Badge>
                <ActionsMenu
                  label={`Actions for ${rule.name}`}
                  items={[
                    {
                      label: 'Edit',
                      icon: <Pencil size={15} />,
                      onClick: () => onEdit(rule),
                    },
                    isPaused
                      ? {
                          label: 'Resume',
                          icon: <Repeat size={15} />,
                          onClick: () => onResume(rule),
                        }
                      : {
                          label: 'Pause',
                          icon: <X size={15} />,
                          onClick: () => onPause(rule),
                        },
                    {
                      label: 'Archive',
                      icon: <Trash size={15} />,
                      danger: true,
                      onClick: () => onArchive(rule),
                    },
                  ]}
                />
              </div>
            </div>
          )
        })}
      </div>

      {archivedRules.length > 0 ? (
        <section className="archived-section" style={{ padding: '0 var(--space-5) var(--space-5)' }}>
          <button
            type="button"
            className="archived-toggle"
            onClick={() => setShowArchived((prev) => !prev)}
            aria-expanded={showArchived}
          >
            {showArchived ? 'Hide' : 'Show'} archived ({archivedRules.length})
          </button>

          {showArchived ? (
            <div className="archived-list">
              {archivedRules.map((rule) => {
                const account = accountById.get(rule.accountId)
                return (
                  <div key={rule.id} className="archived-row">
                    <div style={{ minWidth: 0 }}>
                      <div className="account-name">{rule.name}</div>
                      <div className="account-meta" style={{ textTransform: 'none' }}>
                        Day {rule.dayOfMonth} · {account?.name ?? 'account'}
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onRestore(rule)}
                    >
                      Restore
                    </Button>
                  </div>
                )
              })}
            </div>
          ) : null}
        </section>
      ) : null}
    </Card>
  )
}
