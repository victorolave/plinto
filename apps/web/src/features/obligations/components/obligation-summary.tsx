'use client'

import { useTranslations } from 'next-intl'
import type { ObligationCurrencyTotal } from '../services/obligations'
import { StatGridSkeleton } from '../../../components/ui/stat-grid-skeleton'
import { CurrencyTag } from '../../../components/ui/amount'
import { Amount } from '../../../components/ui/amount'

export interface ObligationSummaryProps {
  totals: ObligationCurrencyTotal[]
  loading: boolean
}

/**
 * The spreadsheet's TOTAL / TOTAL PAID / OUTSTANDING rows.
 *
 * One block per currency, never a combined figure: adding COP to USD would be
 * arithmetic on incomparable units. Outstanding comes from the server as the
 * sum of each obligation's own shortfall, so it stays honest even when
 * something was overpaid — it is deliberately not recomputed here as expected
 * minus paid, which is the same trap the aggregate avoids in SQL.
 */
export function ObligationSummary({ totals, loading }: ObligationSummaryProps) {
  const t = useTranslations('obligations')

  if (loading) {
    // Was a hand-rolled copy of the same three tiles; shares the component now.
    return <StatGridSkeleton cards={3} label={t('loadingTotals')} />
  }

  if (totals.length === 0) {
    return null
  }

  return (
    <>
      {totals.map((total) => (
        <div className="stat-grid" key={total.currency}>
          <Figure
            label={t('total')}
            minor={total.expectedMinor}
            currency={total.currency}
          />
          <Figure label={t('paid')} minor={total.paidMinor} currency={total.currency} />
          <Figure
            label={t('outstanding')}
            minor={total.outstandingMinor}
            currency={total.currency}
            // The figure that answers "do we make it to the end of the month?"
            // — emphasized only when there is an actual shortfall.
            accent={total.outstandingMinor > 0}
          />
        </div>
      ))}
    </>
  )
}

function Figure({
  label,
  minor,
  currency,
  accent = false,
}: {
  label: string
  minor: number
  currency: string
  accent?: boolean
}) {
  return (
    <div className={`stat-card ${accent ? 'stat-card--accent' : ''}`.trim()}>
      <div className="stat-card-top">
        <span className="stat-label">{label}</span>
        <CurrencyTag currency={currency} />
      </div>
      <Amount minor={minor} currency={currency} size="lg" />
    </div>
  )
}
