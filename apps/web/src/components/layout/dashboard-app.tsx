'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../../lib/api/client'
import { listTenants, selectTenant } from '../../features/tenants/services/tenant-selection'
import { AccountsPanel } from '../../features/accounts/components/accounts-panel'
import { TransactionsPanel } from '../../features/transactions/components/transactions-panel'
import { CategoriesPanel } from '../../features/categories/components/categories-panel'
import { ExpenseReportPanel } from '../../features/categories/components/expense-report-panel'
import { DashboardOverview } from '../../features/dashboard/components/dashboard-overview'
import { Sidebar, type DashboardSection } from './sidebar'
import { BottomNav } from './bottom-nav'
import { TopBar } from './top-bar'
import type { TenantOption } from './tenant-switcher'
import { Settings } from '../ui/icons'

interface MeUser {
  name?: string | null
  email?: string | null
}

const TITLES: Record<DashboardSection, [string, (ctx: { name: string; tenant: string }) => string]> = {
  overview: ['Dashboard', ({ name }) => (name ? `Welcome back, ${name}` : 'Your household at a glance')],
  accounts: ['Accounts', () => 'Balances by currency'],
  transactions: ['Transactions', ({ tenant }) => (tenant ? `${tenant} ledger` : 'Income, expenses and transfers')],
  categories: ['Categories', () => 'Organize your spending'],
  reports: ['Reports', () => 'Expenses by category'],
  settings: ['Settings', () => 'Household & members'],
}

export function DashboardApp() {
  const [booting, setBooting] = useState(true)
  const [section, setSection] = useState<DashboardSection>('overview')
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

  const body = useMemo(() => {
    switch (section) {
      case 'overview':
        return <DashboardOverview tenantName={activeTenantName} onNavigate={setSection} />
      case 'accounts':
        return <AccountsPanel />
      case 'transactions':
        return <TransactionsPanel />
      case 'categories':
        return <CategoriesPanel />
      case 'reports':
        return <ExpenseReportPanel />
      case 'settings':
        return (
          <div className="page">
            <div className="plinto-card">
              <div className="empty-state">
                <span className="stat-icon">
                  <Settings size={18} />
                </span>
                <strong style={{ color: 'var(--text-strong)' }}>Settings</strong>
                <p className="muted">
                  Household and member settings live here. This area is coming next.
                </p>
              </div>
            </div>
          </div>
        )
      default:
        return null
    }
  }, [section, activeTenantName])

  if (booting) {
    return (
      <div className="app-loading">
        <span className="brand-square">P</span>
        <span className="muted">Loading your household…</span>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <Sidebar
        active={section}
        onNavigate={setSection}
        tenants={tenants}
        activeTenantId={activeTenantId}
        onSelectTenant={handleSelectTenant}
        user={{ name: user.name || 'Your account', email: user.email || undefined }}
        onLogout={handleLogout}
        loggingOut={loggingOut}
      />
      <div className="app-main">
        <TopBar title={title} subtitle={subtitle} onAdd={() => setSection('transactions')} />
        <div className="app-scroll">{body}</div>
      </div>

      <BottomNav
        active={section}
        onNavigate={setSection}
        onAdd={() => setSection('transactions')}
        tenants={tenants}
        activeTenantId={activeTenantId}
        onSelectTenant={handleSelectTenant}
        user={{ name: user.name || 'Your account', email: user.email || undefined }}
        onLogout={handleLogout}
        loggingOut={loggingOut}
      />
    </div>
  )
}
