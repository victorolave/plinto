'use client'

import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { IconButton } from './button'
import { X } from './icons'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  /** Optional header badge (e.g. household context). */
  badge?: ReactNode
  footer?: ReactNode
  children: ReactNode
}

export function Modal({ open, onClose, title, badge, footer, children }: ModalProps) {
  const t = useTranslations('common')

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="modal-scrim" onClick={onClose} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="card-title">{title}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            {badge}
            <IconButton label={t('close')} onClick={onClose} style={{ border: 'none' }}>
              <X size={18} />
            </IconButton>
          </div>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-footer">{footer}</div> : null}
      </div>
    </div>
  )
}
