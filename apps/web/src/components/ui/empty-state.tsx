import type { ReactNode } from 'react'

export interface EmptyStateProps {
  /** Pre-sized icon element shown inside the brand badge. */
  icon: ReactNode
  title: string
  description?: ReactNode
  /** Primary call to action (e.g. a Button). */
  action?: ReactNode
  /** Tighter variant for in-card / sub-section empties. */
  compact?: boolean
}

/** Shared rich empty state: brand icon badge, title, guidance, optional CTA. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
}: EmptyStateProps) {
  return (
    <div className={`empty ${compact ? 'empty--compact' : ''}`.trim()}>
      <span className="empty-badge">{icon}</span>
      <h3 className="empty-title">{title}</h3>
      {description ? <p className="empty-text">{description}</p> : null}
      {action ? <div className="empty-action">{action}</div> : null}
    </div>
  )
}
