'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  cancelDebt,
  getDebtSummary,
  listDebts,
  type DebtSchedule,
} from '../services/debts'
import { listAccounts } from '../../accounts/services/accounts'
import { queryKeys } from '../../../lib/api/query-keys'
import { DebtForm } from './debt-form'
import { Card, CardHeader } from '../../../components/ui/card'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Drawer } from '../../../components/ui/drawer'
import { Modal } from '../../../components/ui/modal'
import { EmptyState } from '../../../components/ui/empty-state'
import { StatCard } from '../../../components/ui/stat-card'
import { Amount, formatMoneyMagnitude } from '../../../components/ui/amount'
import { Plus, TrendDown } from '../../../components/ui/icons'

function progressOf(debt: DebtSchedule): number {
  if (debt.principalMinor <= 0) return 0
  return Math.min(Math.round((debt.paidMinor / debt.principalMinor) * 100), 100)
}

export function DebtsPanel() {
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [pendingCancel, setPendingCancel] = useState<DebtSchedule | null>(null)

  const {
    data: debts = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.debts,
    queryFn: async () => (await listDebts()).data.debts,
  })

  const { data: totals = [] } = useQuery({
    queryKey: queryKeys.debtSummary,
    queryFn: async () => (await getDebtSummary()).data.summary.totals,
  })

  const { data: accounts = [] } = useQuery({
    queryKey: queryKeys.accounts(),
    queryFn: async () => (await listAccounts()).data.accounts,
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelDebt(id),
    onSuccess: () => {
      setPendingCancel(null)
      void queryClient.invalidateQueries({ queryKey: queryKeys.debts })
      void queryClient.invalidateQueries({ queryKey: queryKeys.debtSummary })
    },
  })

  const errorMessage =
    error instanceof Error
      ? error.message
      : cancelMutation.error instanceof Error
        ? cancelMutation.error.message
        : null

  const active = debts.filter((debt) => debt.status === 'active' && !debt.settled)
  const closed = debts.filter((debt) => debt.status !== 'active' || debt.settled)

  return (
    <div className="page">
      {errorMessage ? <p className="error-text">{errorMessage}</p> : null}

      {totals.length > 0 ? (
        <div className="stat-grid">
          {totals.map((total, index) => (
            <StatCard
              key={total.currency}
              label={`Owed (${total.currency})`}
              valueMinor={total.scheduledOutstandingMinor + total.lenderOwedMinor}
              currency={total.currency}
              accent={index === 0}
              // The two figures are shown together but never merged into one
              // headline: remaining instalments and what the lender accounts
              // carry measure different things.
              deltaLabel={`${formatMoneyMagnitude(
                total.scheduledOutstandingMinor,
                total.currency,
              )} in instalments · ${formatMoneyMagnitude(
                total.lenderOwedMinor,
                total.currency,
              )} on loans and cards`}
              icon={<TrendDown size={16} />}
            />
          ))}
        </div>
      ) : null}

      <div className="categories-head">
        <span className="muted">
          {isLoading
            ? 'Loading…'
            : `${active.length} financed purchase${active.length === 1 ? '' : 's'} in progress`}
        </span>
        <Button leftIcon={<Plus size={18} />} onClick={() => setFormOpen(true)}>
          Record purchase
        </Button>
      </div>

      {!isLoading && debts.length === 0 ? (
        <EmptyState
          icon={<TrendDown size={30} />}
          title="Nothing financed yet"
          description="Record a purchase paid in fixed instalments and each one shows up on the obligations board — ending on its own after the last."
          action={
            <Button leftIcon={<Plus size={18} />} onClick={() => setFormOpen(true)}>
              Record purchase
            </Button>
          }
        />
      ) : null}

      {[
        { title: 'In progress', rows: active },
        { title: 'Finished', rows: closed },
      ]
        .filter((section) => section.rows.length > 0)
        .map((section) => (
          <Card key={section.title} flush>
            <CardHeader title={section.title} />
            <ul className="member-list" aria-label={section.title}>
              {section.rows.map((debt) => (
                <li key={debt.id} className="data-row">
                  <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span className="account-name">
                      {debt.name}{' '}
                      {debt.settled ? (
                        <Badge tone="success">settled</Badge>
                      ) : debt.status === 'cancelled' ? (
                        <Badge tone="neutral">cancelled</Badge>
                      ) : null}
                    </span>
                    <span className="muted" style={{ fontSize: 12 }}>
                      {debt.installmentCount} ×{' '}
                      {formatMoneyMagnitude(debt.installmentMinor, debt.currency)} ·{' '}
                      {progressOf(debt)}% paid
                    </span>
                  </span>
                  <span
                    style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}
                  >
                    <span style={{ textAlign: 'right' }}>
                      <span className="plinto-eyebrow">Left</span>
                      <Amount minor={debt.outstandingMinor} currency={debt.currency} />
                    </span>
                    {debt.status === 'active' && !debt.settled ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Cancel ${debt.name}`}
                        onClick={() => setPendingCancel(debt)}
                      >
                        Cancel
                      </Button>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ))}

      <Drawer
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Record a financed purchase"
        description="Fixed instalments that end on their own"
      >
        <DebtForm accounts={accounts} onSaved={() => setFormOpen(false)} />
      </Drawer>

      <Modal
        open={pendingCancel !== null}
        onClose={() => setPendingCancel(null)}
        title="Cancel this plan?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingCancel(null)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              disabled={cancelMutation.isPending}
              onClick={() => pendingCancel && cancelMutation.mutate(pendingCancel.id)}
            >
              {cancelMutation.isPending ? 'Cancelling…' : 'Cancel plan'}
            </Button>
          </>
        }
      >
        <p className="muted">
          <strong style={{ color: 'var(--text-strong)' }}>{pendingCancel?.name}</strong>{' '}
          stops producing instalments from here on. The ones it already produced
          stay — some of them are paid, and removing them would leave payments
          with no reason behind them.
        </p>
      </Modal>
    </div>
  )
}
