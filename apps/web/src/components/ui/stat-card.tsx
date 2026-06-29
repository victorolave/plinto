import type { ReactNode } from 'react'
import { formatMoneyMagnitude } from './amount'
import { TrendUp, TrendDown } from './icons'

export interface StatCardProps {
  label: string
  /** Value in minor units. */
  valueMinor: number
  currency: string
  /** Percentage delta vs previous period. Positive = up (green). */
  delta?: number
  /** Override the delta caption (e.g. "separate currency"). */
  deltaLabel?: string
  /** High-impact black tile (used for the headline KPI). */
  accent?: boolean
  icon?: ReactNode
}

export function StatCard({
  label,
  valueMinor,
  currency,
  delta,
  deltaLabel,
  accent = false,
  icon,
}: StatCardProps) {
  const hasDelta = typeof delta === 'number' && delta !== 0
  const up = (delta ?? 0) > 0

  return (
    <div className={`stat-card ${accent ? 'stat-card--accent' : ''}`.trim()}>
      <div className="stat-card-top">
        {icon ? <span className="stat-icon">{icon}</span> : null}
        <span className="stat-label">{label}</span>
      </div>
      <span className="stat-value">{formatMoneyMagnitude(valueMinor, currency)}</span>
      {deltaLabel || hasDelta ? (
        <span
          className={`stat-delta ${
            hasDelta ? (up ? 'stat-delta--up' : 'stat-delta--down') : 'stat-delta--flat'
          }`}
        >
          {hasDelta ? (up ? <TrendUp size={13} /> : <TrendDown size={13} />) : null}
          {deltaLabel ?? `${up ? '+' : '−'}${Math.abs(delta ?? 0)}% this month`}
        </span>
      ) : null}
    </div>
  )
}
