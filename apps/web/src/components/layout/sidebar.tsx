'use client'

import Image from 'next/image'
import type { ComponentType } from 'react'
import {
  Home,
  Wallet,
  List,
  Tag,
  Chart,
  Settings,
  LogOut,
  type IconProps,
} from '../ui/icons'
import { Avatar } from '../ui/avatar'
import { IconButton } from '../ui/button'
import { TenantSwitcher, type TenantOption } from './tenant-switcher'

export type DashboardSection =
  | 'overview'
  | 'accounts'
  | 'transactions'
  | 'categories'
  | 'reports'
  | 'settings'

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
  { id: 'reports', label: 'Reports', icon: Chart },
]

export interface SidebarUser {
  name: string
  email?: string
}

export interface SidebarProps {
  active: DashboardSection
  onNavigate: (section: DashboardSection) => void
  tenants: TenantOption[]
  activeTenantId: string | null
  onSelectTenant: (tenantId: string) => void
  user: SidebarUser
  onLogout: () => void
  loggingOut?: boolean
}

function NavItem({
  entry,
  active,
  onNavigate,
}: {
  entry: NavEntry
  active: DashboardSection
  onNavigate: (section: DashboardSection) => void
}) {
  const Icon = entry.icon
  const isActive = entry.id === active
  return (
    <button
      type="button"
      className={`nav-item ${isActive ? 'is-active' : ''}`.trim()}
      aria-current={isActive ? 'page' : undefined}
      onClick={() => onNavigate(entry.id)}
    >
      <span className="nav-item-marker" />
      <Icon size={19} stroke={isActive ? 2.2 : 2} />
      {entry.label}
    </button>
  )
}

export function Sidebar({
  active,
  onNavigate,
  tenants,
  activeTenantId,
  onSelectTenant,
  user,
  onLogout,
  loggingOut = false,
}: SidebarProps) {
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
          <NavItem key={entry.id} entry={entry} active={active} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className="sidebar-footer">
        <button
          type="button"
          className={`nav-item ${active === 'settings' ? 'is-active' : ''}`.trim()}
          onClick={() => onNavigate('settings')}
        >
          <span className="nav-item-marker" />
          <Settings size={19} />
          Settings
        </button>

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
