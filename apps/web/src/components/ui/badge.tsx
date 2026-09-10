import type { ReactNode } from 'react'

type Tone = 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'danger'

export interface BadgeProps {
  tone?: Tone
  dot?: boolean
  children: ReactNode
  className?: string
}

export function Badge({ tone = 'neutral', dot = false, children, className = '' }: BadgeProps) {
  return (
    <span className={`badge badge--${tone} ${className}`.trim()}>
      {dot ? <span className="badge-dot" /> : null}
      {children}
    </span>
  )
}
