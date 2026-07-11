'use client'

import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { IconButton } from './button'
import { X } from './icons'

export interface DrawerProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  /** Optional sub-line under the title. */
  description?: ReactNode
  /** Optional badge shown next to the title (e.g. household context). */
  badge?: ReactNode
  footer?: ReactNode
  children: ReactNode
  /** Wider variant for management surfaces (e.g. recurring rules). */
  size?: 'md' | 'lg'
}

/**
 * Right-side sliding panel for on-demand forms and management surfaces.
 * Becomes a bottom sheet on small screens (see globals.css). Mirrors Modal's
 * behaviour (Escape to close, backdrop click, body scroll lock) but keeps the
 * page context visible alongside the panel.
 */
export function Drawer({
  open,
  onClose,
  title,
  description,
  badge,
  footer,
  children,
  size = 'md',
}: DrawerProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="drawer-scrim" onClick={onClose} role="presentation">
      <aside
        className={`drawer ${size === 'lg' ? 'drawer--lg' : ''}`.trim()}
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="drawer-header">
          <div style={{ minWidth: 0 }}>
            <h2 className="card-title">{title}</h2>
            {description ? <p className="drawer-description">{description}</p> : null}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            {badge}
            <IconButton label="Close" onClick={onClose} style={{ border: 'none' }}>
              <X size={18} />
            </IconButton>
          </div>
        </div>
        <div className="drawer-body">{children}</div>
        {footer ? <div className="drawer-footer">{footer}</div> : null}
      </aside>
    </div>
  )
}
