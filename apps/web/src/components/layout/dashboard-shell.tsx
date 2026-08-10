'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { apiFetch } from '../../lib/api/client'
import { listTenants, selectTenant } from '../../features/tenants/services/tenant-selection'
import { queryKeys } from '../../lib/api/query-keys'
import { Sidebar } from './sidebar'
import { BottomNav } from './bottom-nav'
import { TopBar } from './top-bar'
import { DashboardProvider } from './dashboard-context'
import { SECTION_HREF, sectionFromPath, type DashboardSection } from './dashboard-nav'

interface MeResponse {
  data: {
    activeTenantId: string | null
    user: { name?: string; email?: string }
  }
}

const TITLES: Record<
  DashboardSection,
  [string, (ctx: { name: string; tenant: string }) => string]
> = {
  overview: ['Dashboard', ({ name }) => (name ? `Welcome back, ${name}` : 'Your household at a glance')],
  accounts: ['Accounts', () => 'Balances by currency'],
  transactions: ['Transactions', ({ tenant }) => (tenant ? `${tenant} ledger` : 'Income, expenses and transfers')],
  obligations: ['Obligations', () => 'What the household owes this month'],
  debts: ['Debts', () => 'What the household owes in total'],
  credit: ['Credit', () => 'Cards and rotating lines'],
  categories: ['Categories', () => 'Organize your spending'],
  settings: ['Settings', () => 'Household & members'],
}

/**
 * Persistent dashboard chrome (sidebar, top bar, bottom nav) plus the auth/tenant
 * bootstrap. Lives in the dashboard layout so it survives client-side navigation
 * between section routes; only `{children}` (the active page) remounts.
 */
export function DashboardShell({ children }: { children: ReactNode }) {
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
  const activeTenantName = tenants.find((t) => t.id === activeTenantId)?.name ?? ''
  const [title, subtitleFn] = TITLES[section]
  const subtitle = subtitleFn({ name: firstName, tenant: activeTenantName })
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
        <span className="app-loading__label">Loading your household…</span>
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
        user: { name: user.name || 'Your account', email: user.email || undefined },
        onLogout: handleLogout,
        loggingOut,
      }}
    >
      <div className="app-shell">
        <Sidebar />
        <div className="app-main">
          <TopBar title={title} subtitle={subtitle} onAdd={goToAdd} />
          <div className="app-scroll">{children}</div>
        </div>

        <BottomNav onAdd={goToAdd} />
      </div>
    </DashboardProvider>
  )
}
