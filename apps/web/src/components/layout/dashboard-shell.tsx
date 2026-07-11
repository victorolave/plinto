'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { apiFetch } from '../../lib/api/client'
import { listTenants, selectTenant } from '../../features/tenants/services/tenant-selection'
import { Sidebar } from './sidebar'
import { BottomNav } from './bottom-nav'
import { TopBar } from './top-bar'
import { DashboardProvider } from './dashboard-context'
import { SECTION_HREF, sectionFromPath, type DashboardSection } from './dashboard-nav'
import type { TenantOption } from './tenant-switcher'

interface MeUser {
  name?: string | null
  email?: string | null
}

const TITLES: Record<
  DashboardSection,
  [string, (ctx: { name: string; tenant: string }) => string]
> = {
  overview: ['Dashboard', ({ name }) => (name ? `Welcome back, ${name}` : 'Your household at a glance')],
  accounts: ['Accounts', () => 'Balances by currency'],
  transactions: ['Transactions', ({ tenant }) => (tenant ? `${tenant} ledger` : 'Income, expenses and transfers')],
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

  const [booting, setBooting] = useState(true)
  const [user, setUser] = useState<MeUser>({})
  const [tenants, setTenants] = useState<TenantOption[]>([])
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    const run = async () => {
      try {
        const me = await apiFetch('/me')
        const tenantId = me?.data?.activeTenantId ?? null
        if (!tenantId) {
          window.location.href = '/select-tenant'
          return
        }
        setUser({ name: me?.data?.user?.name, email: me?.data?.user?.email })
        setActiveTenantId(tenantId)

        try {
          const tenantsRes = await listTenants()
          setTenants(tenantsRes?.data?.tenants ?? [])
        } catch {
          // Non-fatal: the switcher just shows the active household name fallback.
        }
        setBooting(false)
      } catch {
        window.location.href = '/login'
      }
    }

    void run()
  }, [])

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
    <DashboardProvider value={{ activeTenantName }}>
      <div className="app-shell">
        <Sidebar
          tenants={tenants}
          activeTenantId={activeTenantId}
          onSelectTenant={handleSelectTenant}
          user={{ name: user.name || 'Your account', email: user.email || undefined }}
          onLogout={handleLogout}
          loggingOut={loggingOut}
        />
        <div className="app-main">
          <TopBar title={title} subtitle={subtitle} onAdd={goToAdd} />
          <div className="app-scroll">{children}</div>
        </div>

        <BottomNav
          onAdd={goToAdd}
          tenants={tenants}
          activeTenantId={activeTenantId}
          onSelectTenant={handleSelectTenant}
          user={{ name: user.name || 'Your account', email: user.email || undefined }}
          onLogout={handleLogout}
          loggingOut={loggingOut}
        />
      </div>
    </DashboardProvider>
  )
}
