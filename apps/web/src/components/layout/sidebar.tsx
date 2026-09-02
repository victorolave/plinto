'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import type { ComponentType } from 'react'
import {
  TrendDown,
  Card,
  Home,
  Wallet,
  List,
  Tag,
  Target,
  Settings,
  LogOut,
  HelpCircle,
  type IconProps,
} from '../ui/icons'
import { useProductTour } from '../../features/onboarding/tour/product-tour-context'
import { Avatar } from '../ui/avatar'
import { IconButton } from '../ui/button'
import { TenantSwitcher } from './tenant-switcher'
import { SECTION_HREF, sectionFromPath, type DashboardSection } from './dashboard-nav'
import { useDashboard } from './dashboard-context'

export type { DashboardSection } from './dashboard-nav'

interface NavEntry {
  id: DashboardSection
  icon: ComponentType<IconProps>
}

// The label is no longer stored here — it is looked up from the `nav` namespace
// by `id` at render time. Keeping a string in this table would mean the nav
// froze into whatever language the module was authored in.
const NAV: NavEntry[] = [
  { id: 'overview', icon: Home },
  { id: 'accounts', icon: Wallet },
  { id: 'transactions', icon: List },
  { id: 'obligations', icon: Target },
  { id: 'debts', icon: TrendDown },
  { id: 'credit', icon: Card },
  { id: 'categories', icon: Tag },
]

function NavItem({ entry, active }: { entry: NavEntry; active: DashboardSection }) {
  const t = useTranslations('nav')
  const Icon = entry.icon
  const isActive = entry.id === active
  return (
    <Link
      href={SECTION_HREF[entry.id]}
      className={`nav-item ${isActive ? 'is-active' : ''}`.trim()}
      aria-current={isActive ? 'page' : undefined}
      data-tour={`nav-${entry.id}`}
    >
      <span className="nav-item-marker" />
      <Icon size={19} stroke={isActive ? 2.2 : 2} />
      {t(entry.id)}
    </Link>
  )
}

/** Reads tenant/user/logout state from DashboardContext — see dashboard-shell.tsx,
 * which is the single provider for this and BottomNav so neither needs the
 * tenants/activeTenantId/onSelectTenant/user/onLogout/loggingOut props threaded in. */
export function Sidebar() {
  const { tenants, activeTenantId, onSelectTenant, user, onLogout, loggingOut } =
    useDashboard()
  const t = useTranslations('nav')
  const tShell = useTranslations('shell')
  const active = sectionFromPath(usePathname() ?? '')
  const { start } = useProductTour()
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        {/* 92×28 is the rendered size at the file's own 3.27:1. The previous
            104×18 was 5.78:1, so the box Next reserved never matched the
            bitmap and the layout shifted once the image decoded. */}
        <Image
          src="/brand/logo-horizontal-white.png"
          alt="Plinto"
          width={92}
          height={28}
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
          data-tour="nav-settings"
        >
          <span className="nav-item-marker" />
          <Settings size={19} />
          {t('settings')}
        </Link>

        <div className="sidebar-user">
          <Avatar name={user.name} size="sm" />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="sidebar-user-name">{user.name}</div>
            {user.email ? <div className="sidebar-user-email">{user.email}</div> : null}
          </div>
          <IconButton
            label={tShell('help')}
            onClick={start}
            data-tour="help-button"
            style={{
              width: 28,
              height: 28,
              background: 'transparent',
              border: 'none',
              color: 'var(--chrome-text-subtle)',
            }}
          >
            <HelpCircle size={16} />
          </IconButton>
          <IconButton
            label={tShell('logOut')}
            onClick={onLogout}
            disabled={loggingOut}
            style={{
              width: 28,
              height: 28,
              background: 'transparent',
              border: 'none',
              color: 'var(--chrome-text-subtle)',
            }}
          >
            <LogOut size={16} />
          </IconButton>
        </div>
      </div>
    </aside>
  )
}
