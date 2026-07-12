'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ComponentType } from 'react'
import {
  Home,
  Wallet,
  List,
  Tag,
  Settings,
  LogOut,
  type IconProps,
} from '../ui/icons'
import { Avatar } from '../ui/avatar'
import { IconButton } from '../ui/button'
import { TenantSwitcher } from './tenant-switcher'
import { SECTION_HREF, sectionFromPath, type DashboardSection } from './dashboard-nav'
import { useDashboard } from './dashboard-context'

export type { DashboardSection } from './dashboard-nav'

interface NavEntry {
  id: DashboardSection
  label: string
  icon: ComponentType<IconProps>
}

const NAV: NavEntry[] = [
  { id: 'overview', label: 'Dashboard', icon: Home },
  { id: 'accounts', label: 'Accounts', icon: Wallet },
  { id: 'transactions', label: 'Transactions', icon: List },
  { id: 'categories', label: 'Categories', icon: Tag },
]

function NavItem({ entry, active }: { entry: NavEntry; active: DashboardSection }) {
  const Icon = entry.icon
  const isActive = entry.id === active
  return (
    <Link
      href={SECTION_HREF[entry.id]}
      className={`nav-item ${isActive ? 'is-active' : ''}`.trim()}
      aria-current={isActive ? 'page' : undefined}
    >
      <span className="nav-item-marker" />
      <Icon size={19} stroke={isActive ? 2.2 : 2} />
      {entry.label}
    </Link>
  )
}

/** Reads tenant/user/logout state from DashboardContext — see dashboard-shell.tsx,
 * which is the single provider for this and BottomNav so neither needs the
 * tenants/activeTenantId/onSelectTenant/user/onLogout/loggingOut props threaded in. */
export function Sidebar() {
  const { tenants, activeTenantId, onSelectTenant, user, onLogout, loggingOut } =
    useDashboard()
  const active = sectionFromPath(usePathname() ?? '')
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <Image
          src="/brand/logo-horizontal-white.png"
          alt="Plinto"
          width={104}
          height={18}
          priority
        />
      </div>

      <TenantSwitcher
        tenants={tenants}
        activeTenantId={activeTenantId}
        onSelect={onSelectTenant}
      />

      <nav className="sidebar-nav">
        {NAV.map((entry) => (
          <NavItem key={entry.id} entry={entry} active={active} />
        ))}
      </nav>

      <div className="sidebar-footer">
        <Link
          href={SECTION_HREF.settings}
          className={`nav-item ${active === 'settings' ? 'is-active' : ''}`.trim()}
          aria-current={active === 'settings' ? 'page' : undefined}
        >
          <span className="nav-item-marker" />
          <Settings size={19} />
          Settings
        </Link>

        <div className="sidebar-user">
          <Avatar name={user.name} size="sm" />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="sidebar-user-name">{user.name}</div>
            {user.email ? <div className="sidebar-user-email">{user.email}</div> : null}
          </div>
          <IconButton
            label="Log out"
            onClick={onLogout}
            disabled={loggingOut}
            style={{
              width: 28,
              height: 28,
              background: 'transparent',
              border: 'none',
              color: 'var(--ink-text-subtle)',
            }}
          >
            <LogOut size={16} />
          </IconButton>
        </div>
      </div>
    </aside>
  )
}
