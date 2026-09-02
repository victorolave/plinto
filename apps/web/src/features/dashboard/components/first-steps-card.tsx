'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { listAccounts } from '../../accounts/services/accounts'
import { listTransactions } from '../../transactions/services/transactions'
import { listObligations } from '../../obligations/services/obligations'
import { currentPeriod } from '../../obligations/lib/period'
import { listCreditLines } from '../../credit/services/credit'
import { listMembers } from '../../members/services/members'
import { queryKeys } from '../../../lib/api/query-keys'
import { Card, CardHeader } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Check } from '../../../components/ui/icons'
import { SECTION_HREF } from '../../../components/layout/dashboard-nav'
import { useDashboard } from '../../../components/layout/dashboard-context'

interface Step {
  id: 'accounts' | 'transactions' | 'obligations' | 'credit' | 'members'
  done: boolean
  href: string
}

/**
 * Onboarding checklist for a brand-new household. Each row points at the
 * section that completes it, and the whole card disappears the moment there
 * is nothing left to do — it is a nudge, not a permanent fixture.
 *
 * "Hidden" is per household, not per user: it lives in localStorage keyed by
 * `activeTenantId`, so dismissing it for one household does not hide it for
 * another the same person switches into.
 */
export function FirstStepsCard() {
  const t = useTranslations('dashboard.firstSteps')
  const router = useRouter()
  const { activeTenantId } = useDashboard()

  const storageKey = `plinto.dashboard.firstSteps.hidden.${activeTenantId ?? 'unknown'}`
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    try {
      setHidden(window.localStorage.getItem(storageKey) === '1')
    } catch {
      setHidden(false)
    }
  }, [storageKey])

  const accountsQuery = useQuery({
    queryKey: queryKeys.accounts(),
    queryFn: async () => (await listAccounts()).data.accounts,
  })
  const transactionsQuery = useQuery({
    queryKey: queryKeys.transactionsTotal,
    queryFn: () => listTransactions({ pageSize: 1 }),
  })
  const period = currentPeriod()
  const obligationsQuery = useQuery({
    queryKey: queryKeys.obligations(period),
    queryFn: async () => (await listObligations(period)).data.obligations,
  })
  const creditQuery = useQuery({
    queryKey: queryKeys.creditLines,
    queryFn: async () => (await listCreditLines()).data.creditLines,
  })
  const membersQuery = useQuery({
    queryKey: queryKeys.members,
    queryFn: async () => (await listMembers()).data.members,
  })

  const queries = [
    accountsQuery,
    transactionsQuery,
    obligationsQuery,
    creditQuery,
    membersQuery,
  ]
  const loading = queries.some((query) => query.isLoading)
  const hasError = queries.some((query) => query.isError)

  const steps: Step[] = [
    {
      id: 'accounts',
      done: (accountsQuery.data?.length ?? 0) > 0,
      href: SECTION_HREF.accounts,
    },
    {
      id: 'transactions',
      done: (transactionsQuery.data?.meta.pagination.total ?? 0) > 0,
      href: SECTION_HREF.transactions,
    },
    {
      id: 'obligations',
      done: (obligationsQuery.data?.length ?? 0) > 0,
      href: SECTION_HREF.obligations,
    },
    {
      id: 'credit',
      done: (creditQuery.data?.length ?? 0) > 0,
      href: SECTION_HREF.credit,
    },
    {
      id: 'members',
      done: (membersQuery.data?.length ?? 0) > 1,
      href: SECTION_HREF.settings,
    },
  ]

  const allDone = steps.every((step) => step.done)

  if (hidden || loading || hasError || allDone) return null

  const handleHide = () => {
    setHidden(true)
    try {
      window.localStorage.setItem(storageKey, '1')
    } catch {
      // Best-effort only: a household that cannot persist the dismissal just
      // sees the card again next time, which is a fine fallback.
    }
  }

  return (
    <Card>
      <CardHeader
        title={t('title')}
        subtitle={t('subtitle')}
        action={
          <Button variant="ghost" size="sm" onClick={handleHide}>
            {t('hide')}
          </Button>
        }
      />
      <ol
        aria-label={t('title')}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
          margin: 0,
          padding: 0,
          listStyle: 'none',
        }}
      >
        {steps.map((step) => (
          <li key={step.id} className="data-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 20,
                  height: 20,
                  flexShrink: 0,
                  border: '1px solid var(--border-strong)',
                  color: step.done ? 'var(--status-positive)' : 'transparent',
                }}
              >
                <Check size={13} />
              </span>
              <button
                type="button"
                className={`link-button${step.done ? ' muted' : ''}`}
                onClick={() => router.push(step.href)}
              >
                {t(`steps.${step.id}`)}
              </button>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  )
}
