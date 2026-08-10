'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useFormattingLocale } from '../../../i18n/formatting'
import { useErrorMessage } from '../../../lib/api/use-error-message'
import {
  type ObligationInstance,
  type ObligationStatus,
  getObligationSummary,
  listObligations,
  removeObligationPayment,
} from '../services/obligations'
import { listTransactions } from '../../transactions/services/transactions'
import { currentPeriod, formatPeriod, shiftPeriod } from '../lib/period'
import { queryKeys } from '../../../lib/api/query-keys'
import { ObligationSummary } from './obligation-summary'
import { ObligationForm } from './obligation-form'
import { ReconcileForm } from './reconcile-form'
import { ObligationsSkeleton } from './obligations-skeleton'
import { Card } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Amount } from '../../../components/ui/amount'
import { Badge } from '../../../components/ui/badge'
import { Drawer } from '../../../components/ui/drawer'
import { EmptyState } from '../../../components/ui/empty-state'
import { ActionsMenu } from '../../../components/ui/actions-menu'
import { ChevronRight, Plus, Repeat, Target } from '../../../components/ui/icons'

// Overdue is the only fault state here: pending and partial are simply where a
// month legitimately sits before its due dates arrive.
const STATUS_TONE: Record<ObligationStatus, 'success' | 'warning' | 'danger' | 'neutral'> =
  {
    pending: 'neutral',
    partial: 'warning',
    paid: 'success',
    overdue: 'danger',
  }

type ActiveDrawer = 'create' | 'reconcile' | null

export function ObligationsPanel() {
  const t = useTranslations('obligations')
  const toErrorMessage = useErrorMessage()
  const locale = useFormattingLocale()
  const queryClient = useQueryClient()
  const [period, setPeriod] = useState(() => currentPeriod())
  const [drawer, setDrawer] = useState<ActiveDrawer>(null)
  const [reconciling, setReconciling] = useState<ObligationInstance | null>(null)

  const obligationsQuery = useQuery({
    queryKey: queryKeys.obligations(period),
    queryFn: async () => (await listObligations(period)).data.obligations,
  })

  const summaryQuery = useQuery({
    queryKey: queryKeys.obligationSummary(period),
    queryFn: async () => (await getObligationSummary(period)).data.summary,
  })

  // Only needed to populate the reconcile picker; the board itself reads
  // nothing from the ledger.
  const transactionsQuery = useQuery({
    queryKey: queryKeys.transactions(),
    queryFn: async () => listTransactions({ pageSize: 100 }),
  })

  const obligations = obligationsQuery.data ?? []
  const totals = summaryQuery.data?.totals ?? []
  const transactions = transactionsQuery.data?.data.transactions ?? []

  const loading = obligationsQuery.isLoading || summaryQuery.isLoading

  // Invalidating the period prefix refreshes both the list and the totals: a
  // reconciliation changes an obligation's status and every figure above it.
  const invalidatePeriod = () => {
    void queryClient.invalidateQueries({ queryKey: ['obligations'] })
  }

  const removePaymentMutation = useMutation({
    mutationFn: (input: { obligationId: string; transactionId: string }) =>
      removeObligationPayment(input.obligationId, input.transactionId),
    onSuccess: invalidatePeriod,
  })

  const error = toErrorMessage(
    removePaymentMutation.error ??
      obligationsQuery.error ??
      summaryQuery.error ??
      transactionsQuery.error,
  )

  // Not memoized: `totals` and `obligations` are fresh arrays on every render
  // (the `?? []` fallbacks), so a useMemo keyed on them would recompute anyway
  // while pretending not to. The set is a handful of currency codes.
  const currencies = [
    ...new Set([
      ...totals.map((total) => total.currency),
      ...obligations.map((obligation) => obligation.currency),
    ]),
  ]

  const closeDrawer = () => {
    setDrawer(null)
    setReconciling(null)
  }

  const handleSaved = () => {
    invalidatePeriod()
    closeDrawer()
  }

  const openReconcile = (obligation: ObligationInstance) => {
    setReconciling(obligation)
    setDrawer('reconcile')
  }

  return (
    <div className="page">
      {error ? <p className="error-text">{error}</p> : null}

      <div className="categories-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPeriod((current) => shiftPeriod(current, -1))}
            aria-label={t('previousMonth')}
          >
            <ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} />
          </Button>
          <strong>{formatPeriod(period, locale)}</strong>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPeriod((current) => shiftPeriod(current, 1))}
            aria-label={t('nextMonth')}
          >
            <ChevronRight size={16} />
          </Button>
        </div>
        <Button leftIcon={<Plus size={18} />} onClick={() => setDrawer('create')}>
          {t('oneOff')}
        </Button>
      </div>

      <ObligationSummary totals={totals} loading={summaryQuery.isLoading} />

      {!loading && obligations.length === 0 ? (
        <EmptyState
          icon={<Target size={30} />}
          title={t('empty.title', { period: formatPeriod(period, locale) })}
          description={t('empty.description')}
          action={
            <Button leftIcon={<Plus size={18} />} onClick={() => setDrawer('create')}>
              {t('oneOff')}
            </Button>
          }
        />
      ) : null}

      {loading || obligations.length > 0 ? (
        <Card flush>
          <div className="data-list">
            {loading ? <ObligationsSkeleton /> : null}
            {obligations.map((obligation) => (
              <div key={obligation.id} className="data-row">
                <div style={{ minWidth: 0 }}>
                  <div className="account-name">
                    {obligation.name}
                    {obligation.sourceType === 'recurring_rule' ? (
                      <Repeat
                        size={13}
                        aria-label={t('fromRecurringRule')}
                        style={{ marginLeft: 'var(--space-2)', opacity: 0.55 }}
                      />
                    ) : null}
                  </div>
                  <div className="account-meta" style={{ textTransform: 'none' }}>
                    {t('dueOn', { date: obligation.dueDate.slice(0, 10) })}
                    {obligation.paidAmountMinor > 0 ? (
                      <>
                        {' · '}
                        {t('settled')}{' '}
                        <Amount
                          minor={obligation.paidAmountMinor}
                          currency={obligation.currency}
                          size="sm"
                        />
                      </>
                    ) : null}
                  </div>
                </div>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}
                >
                  <Amount
                    minor={obligation.expectedAmountMinor}
                    currency={obligation.currency}
                    size="sm"
                  />
                  <Badge tone={STATUS_TONE[obligation.status]}>
                    {t(`status.${obligation.status}`)}
                  </Badge>
                  <ActionsMenu
                    label={t('actionsFor', { name: obligation.name })}
                    items={[
                      {
                        label: t('linkPayment'),
                        icon: <Plus size={15} />,
                        onClick: () => openReconcile(obligation),
                      },
                      ...obligation.payments.map((payment) => ({
                        label: t('unlinkPayment', {
                          reference: payment.transactionId.slice(0, 8),
                        }),
                        danger: true,
                        onClick: () =>
                          removePaymentMutation.mutate({
                            obligationId: obligation.id,
                            transactionId: payment.transactionId,
                          }),
                      })),
                    ]}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Drawer
        open={drawer === 'create'}
        onClose={closeDrawer}
        title={t('oneOff')}
        description={t('recordedIn', { period: formatPeriod(period, locale) })}
      >
        <ObligationForm
          period={period}
          currencies={currencies}
          onSaved={handleSaved}
        />
      </Drawer>

      <Drawer
        open={drawer === 'reconcile' && reconciling !== null}
        onClose={closeDrawer}
        title={t('linkPayment')}
        description={reconciling?.name}
      >
        {reconciling ? (
          <ReconcileForm
            obligation={reconciling}
            transactions={transactions}
            onSaved={handleSaved}
          />
        ) : null}
      </Drawer>
    </div>
  )
}
