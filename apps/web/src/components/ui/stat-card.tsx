'use client'

import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { formatMoneyMagnitude } from './amount'
import { useFormattingLocale } from '../../i18n/formatting'
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
  const t = useTranslations('statCard')
  // Without this the headline figure fell back to the default formatting
  // locale while every other amount on the same screen followed the request's
  // — a stat tile reading `$ 4.560.000` above a row reading `COP 4,560,000`.
  const locale = useFormattingLocale()
  const hasDelta = typeof delta === 'number' && delta !== 0
  const up = (delta ?? 0) > 0

  return (
    <div className={`stat-card ${accent ? 'stat-card--accent' : ''}`.trim()}>
      <div className="stat-card-top">
        {icon ? <span className="stat-icon">{icon}</span> : null}
        <span className="stat-label">{label}</span>
      </div>
      <span className="stat-value">
        {formatMoneyMagnitude(valueMinor, currency, locale)}
      </span>
      {deltaLabel || hasDelta ? (
        <span
          className={`stat-delta ${
            hasDelta ? (up ? 'stat-delta--up' : 'stat-delta--down') : 'stat-delta--flat'
          }`}
        >
          {hasDelta ? (up ? <TrendUp size={13} /> : <TrendDown size={13} />) : null}
          {deltaLabel ??
            t('deltaThisMonth', {
              sign: up ? '+' : '−',
              percent: Math.abs(delta ?? 0),
            })}
        </span>
      ) : null}
    </div>
  )
}
