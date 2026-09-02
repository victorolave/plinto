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

/** localStorage key a household's dismissal is remembered under. */
function storageKeyFor(activeTenantId: string | null): string {
  return `plinto.dashboard.firstSteps.hidden.${activeTenantId ?? 'unknown'}`
}

/** Whether `key` was previously dismissed. Best-effort: a browser that refuses
 * storage access (private mode, blocked cookies) just shows the card again. */
function readHidden(key: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

/**
 * Compact placeholder while the checklist's own five queries resolve.
 *
 * `DashboardOverview` already renders its own skeleton for its own three
 * queries; this one is deliberately smaller and covers only what this card
 * adds, so a household never sees the page pop from "no card" to "card" once
 * accounts/balances/transactions have loaded but obligations/credit/members
 * have not.
 */
function FirstStepsSkeleton({ label }: { label: string }) {
  return (
    <Card role="status" aria-label={label}>
      <div style={{ padding: '0 0 var(--space-4)' }} aria-hidden="true">
        <span className="skeleton skeleton-line skeleton-line--heading" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="data-row" aria-hidden="true">
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flex: 1 }}
            >
              <span className="skeleton" style={{ width: 20, height: 20, flexShrink: 0 }} />
              <span className="skeleton skeleton-line" style={{ width: '55%' }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

export interface FirstStepsCardProps {
  /**
   * Fires whenever the card's own verdict on whether it is showing its real
   * content changes. `DashboardOverview` uses this to suppress its own
   * `noBalances` empty state while this card is visible — both would
   * otherwise say "you have nothing yet" at once.
   */
  onVisibilityChange?: (visible: boolean) => void
}

/**
 * Onboarding checklist for a brand-new household. Each row points at the
 * section that completes it, and the whole card disappears the moment there
 * is nothing left to do — it is a nudge, not a permanent fixture.
 *
 * "Hidden" is per household, not per user: it lives in localStorage keyed by
 * `activeTenantId`, so dismissing it for one household does not hide it for
 * another the same person switches into. Switching tenants reloads the page
 * (see `DashboardShell`), so a fresh `activeTenantId` always arrives via a
 * fresh mount rather than a prop change on this component.
 */
export function FirstStepsCard({ onVisibilityChange }: FirstStepsCardProps = {}) {
  const t = useTranslations('dashboard.firstSteps')
  const router = useRouter()
  const { activeTenantId } = useDashboard()

  const storageKey = storageKeyFor(activeTenantId)
  // Read synchronously on mount, not in an effect: an effect runs after the
  // first commit, by which point `enabled: !hidden` below would already have
  // let every query fire once for a household that dismissed this card.
  const [hidden, setHidden] = useState(() => readHidden(storageKey))

  const accountsQuery = useQuery({
    queryKey: queryKeys.accounts(),
    queryFn: async () => (await listAccounts()).data.accounts,
    enabled: !hidden,
  })
  const transactionsQuery = useQuery({
    queryKey: queryKeys.transactionsTotal,
    queryFn: () => listTransactions({ pageSize: 1 }),
    enabled: !hidden,
  })
  const period = currentPeriod()
  const obligationsQuery = useQuery({
    queryKey: queryKeys.obligations(period),
    queryFn: async () => (await listObligations(period)).data.obligations,
    enabled: !hidden,
  })
  const creditQuery = useQuery({
    queryKey: queryKeys.creditLines,
    queryFn: async () => (await listCreditLines()).data.creditLines,
    enabled: !hidden,
  })
  const membersQuery = useQuery({
    queryKey: queryKeys.members,
    queryFn: async () => (await listMembers()).data.members,
    enabled: !hidden,
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
  // The one state that actually renders the real card — loading (still
  // resolving), hidden (dismissed) and allDone (nothing left to nudge about)
  // all render something else or nothing.
  const visible = !hidden && !loading && !hasError && !allDone

  useEffect(() => {
    onVisibilityChange?.(visible)
  }, [visible, onVisibilityChange])

  if (hidden || hasError) return null
  if (loading) return <FirstStepsSkeleton label={t('title')} />
  if (allDone) return null

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
