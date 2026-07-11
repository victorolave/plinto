'use client'

import { useEffect, useState } from 'react'
import type { ComponentType } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  Wallet,
  List,
  Tag,
  Chart,
  Settings,
  LogOut,
  Plus,
  Menu,
  X,
  type IconProps,
} from '../ui/icons'
import { Avatar } from '../ui/avatar'
import { TenantSwitcher, type TenantOption } from './tenant-switcher'
import { SECTION_HREF, sectionFromPath, type DashboardSection } from './dashboard-nav'

interface BarEntry {
  id: DashboardSection
  label: string
  icon: ComponentType<IconProps>
}

/** Sections shown directly in the bottom bar (flanking the central add button). */
const PRIMARY: BarEntry[] = [
  { id: 'overview', label: 'Home', icon: Home },
  { id: 'accounts', label: 'Accounts', icon: Wallet },
]
const SECONDARY: BarEntry[] = [
  { id: 'transactions', label: 'Transactions', icon: List },
]

/** Sections that live inside the "More" sheet (everything not in the bar). */
const MORE_SECTIONS: BarEntry[] = [
  { id: 'categories', label: 'Categories', icon: Tag },
  { id: 'reports', label: 'Reports', icon: Chart },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export interface BottomNavProps {
  onAdd: () => void
  tenants: TenantOption[]
  activeTenantId: string | null
  onSelectTenant: (tenantId: string) => void
  user: { name: string; email?: string }
  onLogout: () => void
  loggingOut?: boolean
}

function BarLink({ entry, active }: { entry: BarEntry; active: DashboardSection }) {
  const Icon = entry.icon
  const isActive = entry.id === active
  return (
    <Link
      href={SECTION_HREF[entry.id]}
      className={`bottom-nav-item ${isActive ? 'is-active' : ''}`.trim()}
      aria-current={isActive ? 'page' : undefined}
    >
      <Icon size={21} stroke={isActive ? 2.3 : 2} />
      <span>{entry.label}</span>
    </Link>
  )
}

export function BottomNav({
  onAdd,
  tenants,
  activeTenantId,
  onSelectTenant,
  user,
  onLogout,
  loggingOut = false,
}: BottomNavProps) {
  const [moreOpen, setMoreOpen] = useState(false)
  const active = sectionFromPath(usePathname() ?? '')

  // Lock the scrollable shell (.app-scroll) while the sheet is open — locking
  // body is a no-op here since body never scrolls, and on iOS touch would bleed
  // through the fixed scrim to the content behind it.
  useEffect(() => {
    if (!moreOpen) return
    const scroller = document.querySelector<HTMLElement>('.app-scroll')
    if (!scroller) return
    const prev = scroller.style.overflow
    scroller.style.overflow = 'hidden'
    return () => {
      scroller.style.overflow = prev
    }
  }, [moreOpen])

  // "More" is active when the current section isn't one of the bar's own slots.
  const barIds = ['overview', 'accounts', 'transactions']
  const moreActive = !barIds.includes(active)

  return (
    <>
      <nav className="bottom-nav" aria-label="Primary">
        {PRIMARY.map((entry) => (
          <BarLink key={entry.id} entry={entry} active={active} />
        ))}

        <button
          type="button"
          className="bottom-nav-add"
          onClick={() => {
            setMoreOpen(false)
            onAdd()
          }}
          aria-label="Add transaction"
        >
          <Plus size={24} stroke={2.4} />
        </button>

        {SECONDARY.map((entry) => (
          <BarLink key={entry.id} entry={entry} active={active} />
        ))}

        <button
          type="button"
          className={`bottom-nav-item ${moreActive ? 'is-active' : ''}`.trim()}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((v) => !v)}
        >
          <Menu size={21} stroke={moreActive ? 2.3 : 2} />
          <span>More</span>
        </button>
      </nav>

      {moreOpen ? (
        <div
          className="more-sheet-scrim"
          role="presentation"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="more-sheet"
            role="dialog"
            aria-label="More"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="more-sheet-handle" aria-hidden="true" />

            <div className="more-sheet-head">
              <Avatar name={user.name} size="sm" />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="more-sheet-name">{user.name}</div>
                {user.email ? <div className="more-sheet-email">{user.email}</div> : null}
              </div>
              <button
                type="button"
                className="more-sheet-close"
                aria-label="Close"
                onClick={() => setMoreOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <TenantSwitcher
              tenants={tenants}
              activeTenantId={activeTenantId}
              onSelect={(id) => {
                setMoreOpen(false)
                onSelectTenant(id)
              }}
            />

            <div className="more-sheet-grid">
              {MORE_SECTIONS.map((entry) => {
                const Icon = entry.icon
                const isActive = entry.id === active
                return (
                  <Link
                    key={entry.id}
                    href={SECTION_HREF[entry.id]}
                    className={`more-sheet-item ${isActive ? 'is-active' : ''}`.trim()}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => setMoreOpen(false)}
                  >
                    <Icon size={20} stroke={isActive ? 2.3 : 2} />
                    {entry.label}
                  </Link>
                )
              })}
            </div>

            <button
              type="button"
              className="more-sheet-logout"
              onClick={onLogout}
              disabled={loggingOut}
            >
              <LogOut size={18} />
              {loggingOut ? 'Logging out…' : 'Log out'}
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}
