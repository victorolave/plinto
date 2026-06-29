'use client'

import { Plus, Bell } from '../ui/icons'
import { Button, IconButton } from '../ui/button'

export interface TopBarProps {
  title: string
  subtitle?: string
  /** Primary action; when provided renders the "Add transaction" button. */
  onAdd?: () => void
  addLabel?: string
}

export function TopBar({ title, subtitle, onAdd, addLabel = 'Add transaction' }: TopBarProps) {
  return (
    <header className="topbar">
      <div style={{ minWidth: 0 }}>
        <h1 className="topbar-title">{title}</h1>
        {subtitle ? <div className="topbar-subtitle">{subtitle}</div> : null}
      </div>

      <div className="topbar-actions">
        <IconButton label="Notifications">
          <Bell size={18} />
        </IconButton>
        {onAdd ? (
          <Button leftIcon={<Plus size={18} />} onClick={onAdd}>
            {addLabel}
          </Button>
        ) : null}
      </div>
    </header>
  )
}
