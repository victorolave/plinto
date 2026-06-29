import type { HTMLAttributes, ReactNode } from 'react'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Remove inner padding so headers/lists can manage their own spacing. */
  flush?: boolean
}

export function Card({ flush = false, className = '', children, ...rest }: CardProps) {
  const classes = ['plinto-card', flush ? 'plinto-card--flush' : '', className]
    .filter(Boolean)
    .join(' ')
  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  )
}

export interface CardHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  className?: string
}

export function CardHeader({ title, subtitle, action, className = '' }: CardHeaderProps) {
  return (
    <div className={`card-header ${className}`.trim()}>
      <div>
        <div className="card-title">{title}</div>
        {subtitle ? <div className="card-subtitle">{subtitle}</div> : null}
      </div>
      {action ? <div className="card-action">{action}</div> : null}
    </div>
  )
}
