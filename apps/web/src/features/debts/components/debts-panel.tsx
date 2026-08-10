'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useFormattingLocale } from '../../../i18n/formatting'
import { useErrorMessage } from '../../../lib/api/use-error-message'
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
import { StatGridSkeleton } from '../../../components/ui/stat-grid-skeleton'
import { DebtsListSkeleton } from './debts-skeleton'
import { Amount, formatMoneyMagnitude } from '../../../components/ui/amount'
import { Plus, TrendDown } from '../../../components/ui/icons'

function progressOf(debt: DebtSchedule): number {
  if (debt.principalMinor <= 0) return 0
  return Math.min(Math.round((debt.paidMinor / debt.principalMinor) * 100), 100)
}

export function DebtsPanel() {
  const t = useTranslations('debts')
  const tCommon = useTranslations('common')
  const toErrorMessage = useErrorMessage()
  const locale = useFormattingLocale()
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

  const errorMessage = toErrorMessage(error ?? cancelMutation.error)

  const active = debts.filter((debt) => debt.status === 'active' && !debt.settled)
  const closed = debts.filter((debt) => debt.status !== 'active' || debt.settled)

  return (
    <div className="page">
      {errorMessage ? <p className="error-text">{errorMessage}</p> : null}

      {isLoading ? <StatGridSkeleton cards={1} /> : null}

      {totals.length > 0 ? (
        <div className="stat-grid">
          {totals.map((total, index) => (
            <StatCard
              key={total.currency}
              label={t('owed', { currency: total.currency })}
              valueMinor={total.scheduledOutstandingMinor + total.lenderOwedMinor}
              currency={total.currency}
              accent={index === 0}
              // The two figures are shown together but never merged into one
              // headline: remaining instalments and what the lender accounts
              // carry measure different things.
              deltaLabel={t('owedBreakdown', {
                instalments: formatMoneyMagnitude(
                  total.scheduledOutstandingMinor,
                  total.currency,
                  locale,
                ),
                loans: formatMoneyMagnitude(
                  total.lenderOwedMinor,
                  total.currency,
                  locale,
                ),
              })}
              icon={<TrendDown size={16} />}
            />
          ))}
        </div>
      ) : null}

      <div className="categories-head">
        {/* A placeholder rather than the word "Loading…" — the skeletons above
            and below already say the page is busy. */}
        {isLoading ? (
          <span
            className="skeleton skeleton-line"
            style={{ width: 168, height: 12 }}
            aria-hidden="true"
          />
        ) : (
          <span className="muted">{t('inProgressCount', { count: active.length })}</span>
        )}
        <Button leftIcon={<Plus size={18} />} onClick={() => setFormOpen(true)}>
          {t('recordPurchase')}
        </Button>
      </div>

      {!isLoading && debts.length === 0 ? (
        <EmptyState
          icon={<TrendDown size={30} />}
          title={t('empty.title')}
          description={t('empty.description')}
          action={
            <Button leftIcon={<Plus size={18} />} onClick={() => setFormOpen(true)}>
              {t('recordPurchase')}
            </Button>
          }
        />
      ) : null}

      {isLoading ? <DebtsListSkeleton /> : null}

      {[
        { id: 'inProgress', title: t('section.inProgress'), rows: active },
        { id: 'finished', title: t('section.finished'), rows: closed },
      ]
        .filter((section) => section.rows.length > 0)
        .map((section) => (
          <Card key={section.id} flush>
            <CardHeader title={section.title} />
            <ul className="member-list" aria-label={section.title}>
              {section.rows.map((debt) => (
                <li key={debt.id} className="data-row">
                  <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span className="account-name">
                      {debt.name}{' '}
                      {debt.settled ? (
                        <Badge tone="success">{t('badge.settled')}</Badge>
                      ) : debt.status === 'cancelled' ? (
                        <Badge tone="neutral">{t('badge.cancelled')}</Badge>
                      ) : null}
                    </span>
                    <span className="muted" style={{ fontSize: 12 }}>
                      {t('installmentSummary', {
                        count: debt.installmentCount,
                        amount: formatMoneyMagnitude(
                          debt.installmentMinor,
                          debt.currency,
                          locale,
                        ),
                        percent: progressOf(debt),
                      })}
                    </span>
                  </span>
                  <span
                    style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}
                  >
                    <span style={{ textAlign: 'right' }}>
                      <span className="plinto-eyebrow">{t('left')}</span>
                      <Amount minor={debt.outstandingMinor} currency={debt.currency} />
                    </span>
                    {debt.status === 'active' && !debt.settled ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={t('cancelDebtFor', { name: debt.name })}
                        onClick={() => setPendingCancel(debt)}
                      >
                        {tCommon('cancel')}
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
        title={t('drawer.title')}
        description={t('drawer.description')}
      >
        <DebtForm accounts={accounts} onSaved={() => setFormOpen(false)} />
      </Drawer>

      <Modal
        open={pendingCancel !== null}
        onClose={() => setPendingCancel(null)}
        title={t('cancelModal.title')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingCancel(null)}>
              {t('cancelModal.keepIt')}
            </Button>
            <Button
              variant="danger"
              disabled={cancelMutation.isPending}
              onClick={() => pendingCancel && cancelMutation.mutate(pendingCancel.id)}
            >
              {cancelMutation.isPending
                ? t('cancelModal.cancelling')
                : t('cancelModal.confirm')}
            </Button>
          </>
        }
      >
        <p className="muted">
          {t.rich('cancelModal.body', {
            name: pendingCancel?.name ?? '',
            strong: (chunks) => (
              <strong style={{ color: 'var(--text-strong)' }}>{chunks}</strong>
            ),
          })}
        </p>
      </Modal>
    </div>
  )
}
