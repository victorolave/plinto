'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
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

export type FirstStepsStatus = 'loading' | 'visible' | 'hidden'

/**
 * Module-level store for whether the first-steps card currently has real
 * content to show. `ProductTourAutostart` (dashboard-shell.tsx's tree, not a
 * parent/child of this card — it lives deep inside a route's page content)
 * reads this to know when it's safe to include the `firstSteps` tour step,
 * instead of racing the card's own five queries and finding the anchor
 * missing on almost every real first login.
 *
 * A plain module singleton rather than React context: the two components
 * don't share a common ancestor closer than the whole app, and the value is
 * genuinely global (there is only ever one first-steps card mounted at a
 * time — see the tenant-switch-reloads-the-page note on `FirstStepsCard`).
 */
let firstStepsStatus: FirstStepsStatus = 'loading'
const firstStepsStatusListeners = new Set<() => void>()

function setFirstStepsStatus(next: FirstStepsStatus) {
  if (firstStepsStatus === next) return
  firstStepsStatus = next
  firstStepsStatusListeners.forEach((listener) => listener())
}

function subscribeFirstStepsStatus(listener: () => void): () => void {
  firstStepsStatusListeners.add(listener)
  return () => firstStepsStatusListeners.delete(listener)
}

/** Current first-steps readiness: `'loading'` until its queries settle, then
 * `'visible'` (it has content) or `'hidden'` (dismissed/errored/all done). */
export function useFirstStepsStatus(): FirstStepsStatus {
  return useSyncExternalStore(
    subscribeFirstStepsStatus,
    () => firstStepsStatus,
    () => 'loading',
  )
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
 * Fired by `showFirstStepsAgain` so a currently-mounted card can un-hide
 * itself without a full remount. A `window` event (rather than a second
 * module-level store) because there is exactly one consumer and the payload
 * is trivial — no need to duplicate the `firstStepsStatus` subscription
 * plumbing above for this.
 */
const SHOW_FIRST_STEPS_EVENT = 'plinto:first-steps:show'

interface ShowFirstStepsDetail {
  tenantId: string | null
}

/**
 * Settings' help card calls this to let a household see the checklist again
 * after dismissing it. Clearing the storage key is enough on its own — the
 * card reads it fresh on every mount (e.g. after `router.push('/dashboard')`
 * from Settings) — the event only matters for the case where the card is
 * *already* mounted (dashboard open in another tab, or a future surface that
 * renders it alongside Settings) so it doesn't need a remount to reappear.
 */
export function showFirstStepsAgain(tenantId: string | null): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(storageKeyFor(tenantId))
  } catch {
    // Best-effort: if we can't clear it, the card just stays hidden until
    // storage access works again — never a crash.
  }
  window.dispatchEvent(
    new CustomEvent<ShowFirstStepsDetail>(SHOW_FIRST_STEPS_EVENT, { detail: { tenantId } }),
  )
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
  const { activeTenantId, tenants } = useDashboard()
  const isDemoTenant = tenants.find((tenant) => tenant.id === activeTenantId)?.isDemo ?? false

  const storageKey = storageKeyFor(activeTenantId)
  // Read synchronously on mount, not in an effect: an effect runs after the
  // first commit, by which point `enabled: !hidden` below would already have
  // let every query fire once for a household that dismissed this card.
  const [hidden, setHidden] = useState(() => readHidden(storageKey))

  const accountsQuery = useQuery({
    queryKey: queryKeys.accounts(),
    queryFn: async () => (await listAccounts()).data.accounts,
    enabled: !hidden && !isDemoTenant,
  })
  const transactionsQuery = useQuery({
    queryKey: queryKeys.transactionsTotal,
    queryFn: () => listTransactions({ pageSize: 1 }),
    enabled: !hidden && !isDemoTenant,
  })
  const period = currentPeriod()
  const obligationsQuery = useQuery({
    queryKey: queryKeys.obligations(period),
    queryFn: async () => (await listObligations(period)).data.obligations,
    enabled: !hidden && !isDemoTenant,
  })
  const creditQuery = useQuery({
    queryKey: queryKeys.creditLines,
    queryFn: async () => (await listCreditLines()).data.creditLines,
    enabled: !hidden && !isDemoTenant,
  })
  const membersQuery = useQuery({
    queryKey: queryKeys.members,
    queryFn: async () => (await listMembers()).data.members,
    enabled: !hidden && !isDemoTenant,
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

  // Lets `showFirstStepsAgain` (Settings' help card) un-hide this card
  // in-place when it happens to already be mounted, instead of relying
  // purely on a remount to re-read storage.
  useEffect(() => {
    function onShowAgain(event: Event) {
      const detail = (event as CustomEvent<ShowFirstStepsDetail>).detail
      if (detail?.tenantId === activeTenantId) {
        setHidden(false)
      }
    }
    window.addEventListener(SHOW_FIRST_STEPS_EVENT, onShowAgain)
    return () => window.removeEventListener(SHOW_FIRST_STEPS_EVENT, onShowAgain)
  }, [activeTenantId])

  // Reset on every mount (not just the first ever): a household can leave
  // `/dashboard` and come back, remounting this card with fresh queries —
  // the tour's autostart effect must see a fresh 'loading' each time, not a
  // stale 'visible'/'hidden' left over from a previous mount.
  useEffect(() => {
    setFirstStepsStatus('loading')
  }, [])

  // Mirrors the render logic below 1:1, so a consumer of the status never
  // disagrees with what the card is actually showing. A demo tenant disables
  // every query above, so `loading`/`allDone` alone would never settle to
  // 'hidden' on their own — `isDemoTenant` is checked explicitly so the tour
  // autostart doesn't wait out its full grace period for a card that will
  // never render in this tenant.
  useEffect(() => {
    if (hidden || hasError || allDone || isDemoTenant) {
      setFirstStepsStatus('hidden')
    } else if (loading) {
      setFirstStepsStatus('loading')
    } else {
      setFirstStepsStatus('visible')
    }
  }, [hidden, hasError, allDone, loading, isDemoTenant])

  if (hidden || hasError || isDemoTenant) return null

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
    <Card data-tour="first-steps">
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
