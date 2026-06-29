'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Check } from '../ui/icons'

export interface TenantOption {
  id: string
  name: string
}

export interface TenantSwitcherProps {
  tenants: TenantOption[]
  activeTenantId: string | null
  onSelect: (tenantId: string) => void
}

/** Household switcher pinned at the top of the sidebar — tenant context stays visible. */
export function TenantSwitcher({ tenants, activeTenantId, onSelect }: TenantSwitcherProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const active = tenants.find((t) => t.id === activeTenantId) ?? tenants[0] ?? null
  const mark = (active?.name ?? 'P').trim().charAt(0).toUpperCase()

  useEffect(() => {
    if (!open) return
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  return (
    <div className="tenant-switcher" ref={ref}>
      <button
        type="button"
        className="tenant-switcher-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={tenants.length === 0}
      >
        <span className="tenant-switcher-mark">{mark}</span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span className="tenant-switcher-name" style={{ display: 'block' }}>
            {active?.name ?? 'Select household'}
          </span>
          <span className="tenant-switcher-role">Household</span>
        </span>
        <ChevronDown size={16} />
      </button>

      {open ? (
        <div className="tenant-switcher-menu" role="listbox">
          {tenants.map((tenant) => {
            const isActive = tenant.id === active?.id
            return (
              <button
                key={tenant.id}
                type="button"
                role="option"
                aria-selected={isActive}
                className={`tenant-switcher-option ${isActive ? 'is-active' : ''}`.trim()}
                onClick={() => {
                  setOpen(false)
                  if (!isActive) onSelect(tenant.id)
                }}
              >
                <span className="tenant-switcher-mark">
                  {tenant.name.trim().charAt(0).toUpperCase()}
                </span>
                <span style={{ flex: 1, minWidth: 0 }} className="tenant-switcher-name">
                  {tenant.name}
                </span>
                {isActive ? <Check size={15} /> : null}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
