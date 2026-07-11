'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { IconButton } from './button'
import { MoreVertical } from './icons'

export interface ActionMenuItem {
  label: string
  icon?: ReactNode
  onClick: () => void
  danger?: boolean
}

/** Reusable kebab (⋮) dropdown of row/card actions. Closes on outside click and Escape. */
export function ActionsMenu({
  items,
  label = 'Actions',
}: {
  items: ActionMenuItem[]
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="actions-menu" ref={ref}>
      <IconButton
        label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <MoreVertical size={16} />
      </IconButton>

      {open ? (
        <div className="actions-menu-list" role="menu">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={`actions-menu-item ${item.danger ? 'actions-menu-item--danger' : ''}`.trim()}
              onClick={() => {
                setOpen(false)
                item.onClick()
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
