'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { apiFetch } from '../../lib/api/client'
import { listTenants, selectTenant } from '../../features/tenants/services/tenant-selection'
import { queryKeys } from '../../lib/api/query-keys'
import { Sidebar } from './sidebar'
import { BottomNav } from './bottom-nav'
import { TopBar } from './top-bar'
import { DashboardProvider } from './dashboard-context'
import { SECTION_HREF, sectionFromPath, type DashboardSection } from './dashboard-nav'
import { ProductTourAutostart } from '../../features/onboarding/tour/product-tour-autostart'
import { ProductTourProvider } from '../../features/onboarding/tour/product-tour-context'

interface MeResponse {
  data: {
    activeTenantId: string | null
    user: { name?: string; email?: string; onboardingTourSeenAt?: string | null }
  }
}

/**
 * Which subtitle key a section uses, and whether it takes a value.
 *
 * The English copy used to live inline here as template literals. Two of the
 * eight subtitles are conditional on runtime data (a first name, a household
 * name), which is why this is a small table rather than a flat key lookup —
 * the condition is structure, not language, so it stays in code while every
 * word of it moves to the catalogue.
 */
type SubtitleResolver = (ctx: { name: string; tenant: string }) => {
  key: string
  values?: Record<string, string>
}

const SUBTITLE: Record<DashboardSection, SubtitleResolver> = {
  overview: ({ name }) =>
    name
      ? { key: 'subtitle.overviewWelcome', values: { name } }
      : { key: 'subtitle.overviewGeneric' },
  accounts: () => ({ key: 'subtitle.accounts' }),
  transactions: ({ tenant }) =>
    tenant
      ? { key: 'subtitle.transactionsTenant', values: { tenant } }
      : { key: 'subtitle.transactionsGeneric' },
  obligations: () => ({ key: 'subtitle.obligations' }),
  debts: () => ({ key: 'subtitle.debts' }),
  credit: () => ({ key: 'subtitle.credit' }),
  categories: () => ({ key: 'subtitle.categories' }),
  settings: () => ({ key: 'subtitle.settings' }),
}

/**
 * Persistent dashboard chrome (sidebar, top bar, bottom nav) plus the auth/tenant
 * bootstrap. Lives in the dashboard layout so it survives client-side navigation
 * between section routes; only `{children}` (the active page) remounts.
 */
export function DashboardShell({ children }: { children: ReactNode }) {
  const t = useTranslations('shell')
  const router = useRouter()
  const pathname = usePathname()
  const section = sectionFromPath(pathname)

  const [loggingOut, setLoggingOut] = useState(false)

  // Bootstrap: who is the current user, and which tenant is active. Kept on
  // TanStack Query so it shares the same cache/retry story as the rest of the
  // app, but the redirect side-effects below preserve the original imperative
  // bootstrap's behavior exactly: no session/failed fetch -> /login, no active
  // tenant -> /select-tenant.
  const meQuery = useQuery({
    queryKey: queryKeys.me,
    queryFn: () => apiFetch<MeResponse>('/me'),
    retry: false,
  })

  const activeTenantId = meQuery.data?.data?.activeTenantId ?? null
  const hasActiveSession = meQuery.isSuccess && activeTenantId !== null

  // Only fetched once the /me bootstrap resolved a tenant — mirrors the
  // original sequential `await listTenants()` after the tenant id was known.
  const tenantsQuery = useQuery({
    queryKey: queryKeys.tenants,
    queryFn: async () => (await listTenants())?.data?.tenants ?? [],
    enabled: hasActiveSession,
    retry: false,
  })

  useEffect(() => {
    if (meQuery.isError) {
      window.location.href = '/login'
      return
    }
    if (meQuery.isSuccess && activeTenantId === null) {
      window.location.href = '/select-tenant'
    }
  }, [meQuery.isError, meQuery.isSuccess, activeTenantId])

  // Stays true (loading screen shown) until the session AND tenant list have
  // both settled — same gate as the original `setBooting(false)` call, which
  // only ran after `listTenants()` (success or swallowed failure) completed.
  const booting = !hasActiveSession || tenantsQuery.isPending

  const user = {
    name: meQuery.data?.data?.user?.name,
    email: meQuery.data?.data?.user?.email,
    onboardingTourSeenAt: meQuery.data?.data?.user?.onboardingTourSeenAt,
  }
  const tenants = tenantsQuery.data ?? []

  const handleSelectTenant = async (tenantId: string) => {
    try {
      await selectTenant(tenantId)
      // Reload so every panel refetches against the newly active household.
      window.location.reload()
    } catch {
      // Swallow — staying on the current household is the safe fallback.
    }
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    } finally {
      window.location.href = '/login'
    }
  }

  const firstName = (user.name ?? '').trim().split(/\s+/)[0] ?? ''
  const activeTenantName = tenants.find((tenant) => tenant.id === activeTenantId)?.name ?? ''
  const title = t(`title.${section}`)
  const resolvedSubtitle = SUBTITLE[section]({ name: firstName, tenant: activeTenantName })
  const subtitle = t(resolvedSubtitle.key, resolvedSubtitle.values)
  const goToAdd = () => router.push(SECTION_HREF.transactions)

  if (booting) {
    return (
      <div className="app-loading" role="status" aria-live="polite">
        <span className="app-loading__brand">
          <Image
            src="/brand/logo-horizontal.png"
            alt="Plinto"
            width={144}
            height={44}
            priority
          />
        </span>
        <span className="app-loading__label">{t('loading')}</span>
        <span className="app-loading__bar" aria-hidden="true" />
      </div>
    )
  }

  return (
    <DashboardProvider
      value={{
        activeTenantName,
        tenants,
        activeTenantId,
        onSelectTenant: handleSelectTenant,
        user: { name: user.name || t('yourAccount'), email: user.email || undefined },
        onLogout: handleLogout,
        loggingOut,
      }}
    >
      <ProductTourProvider>
        <div className="app-shell">
          <Sidebar />
          <div className="app-main">
            <TopBar title={title} subtitle={subtitle} onAdd={goToAdd} />
            <div className="app-scroll">{children}</div>
          </div>

          <BottomNav onAdd={goToAdd} />
        </div>

        <ProductTourAutostart
          onboardingTourSeenAt={user.onboardingTourSeenAt}
          ready={!booting}
        />
      </ProductTourProvider>
    </DashboardProvider>
  )
}
