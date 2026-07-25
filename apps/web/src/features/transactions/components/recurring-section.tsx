'use client'

import type { Account } from '../../accounts/services/accounts'
import type {
  RecurringRuleStatus,
  RecurringTransactionRule,
} from '../services/recurring-transactions'
import { Card, CardHeader } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Amount } from '../../../components/ui/amount'
import { Badge } from '../../../components/ui/badge'
import { Plus, Repeat } from '../../../components/ui/icons'
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
}

/** Read-only list of recurring rules shown on the main transactions view. */
export function RecurringSection({
  rules,
  accounts,
  loading,
  onAdd,
}: RecurringSectionProps) {
  const accountById = new Map(accounts.map((a) => [a.id, a]))

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
        {!loading && rules.length === 0 ? (
          <EmptyState
            compact
            icon={<Repeat size={24} />}
            title="No recurring rules yet"
            description="Automate rent, salary or subscriptions — they post themselves each month when due."
          />
        ) : null}
        {rules.map((rule) => {
          const account = accountById.get(rule.accountId)
          const currency = rule.currency ?? account?.currency ?? ''
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
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
