'use client'

import { useTranslations } from 'next-intl'
import { Plus } from '../ui/icons'
import { Button } from '../ui/button'

export interface TopBarProps {
  title: string
  subtitle?: string
  /** Primary action; when provided renders the "Add transaction" button. */
  onAdd?: () => void
  /** Overrides the default "Add transaction" copy. Already localised by the caller. */
  addLabel?: string
}

export function TopBar({ title, subtitle, onAdd, addLabel }: TopBarProps) {
  const t = useTranslations('shell')

  return (
    <header className="topbar">
      <div style={{ minWidth: 0 }}>
        <h1 className="topbar-title">{title}</h1>
        {subtitle ? <div className="topbar-subtitle">{subtitle}</div> : null}
      </div>

      <div className="topbar-actions">
        {onAdd ? (
          <Button leftIcon={<Plus size={18} />} onClick={onAdd}>
            {addLabel ?? t('addTransaction')}
          </Button>
        ) : null}
      </div>
    </header>
  )
}
