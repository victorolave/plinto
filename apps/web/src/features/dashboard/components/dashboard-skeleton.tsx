/**
 * Loading placeholder for the dashboard.
 *
 * This one mattered most: the overview replaced its ENTIRE body with a single
 * `<p>Loading your household…</p>`, so the landing screen of the app collapsed
 * to one line of text and then snapped back to a full page. It mirrors the real
 * layout instead — the balances row, then the two-column panel grid with recent
 * activity beside the accounts list.
 */

import { type CSSProperties } from 'react'
import { useTranslations } from 'next-intl'
import { Card } from '../../../components/ui/card'
import { StatGridSkeleton } from '../../../components/ui/stat-grid-skeleton'

function TransactionRowSkeleton() {
  return (
    <div className="tx-row" aria-hidden="true">
      <span className="skeleton skeleton-avatar" style={{ width: 34, height: 34 }} />
      <div className="tx-main" style={{ minWidth: 0, flex: 1 }}>
        <span className="skeleton skeleton-line" style={{ width: '44%', height: 13 }} />
        <span
          className="skeleton skeleton-line"
          style={{ width: '28%', height: 10, marginTop: 'var(--space-2)' }}
        />
      </div>
      <div className="tx-right">
        <span className="skeleton skeleton-line" style={{ width: 76, height: 14 }} />
      </div>
    </div>
  )
}

function AccountRowSkeleton() {
  return (
    <div className="data-row" aria-hidden="true">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          minWidth: 0,
          flex: 1,
        }}
      >
        <span className="skeleton skeleton-avatar" style={{ width: 34, height: 34 }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <span className="skeleton skeleton-line" style={{ width: '52%', height: 13 }} />
          <span
            className="skeleton skeleton-line"
            style={{ width: '30%', height: 9, marginTop: 'var(--space-2)' }}
          />
        </div>
      </div>
      <span className="skeleton skeleton-line" style={{ width: 72, height: 13 }} />
    </div>
  )
}

export function DashboardSkeleton() {
  const t = useTranslations('dashboard')

  return (
    <div role="status" aria-label={t('loading')}>
      <StatGridSkeleton cards={2} />

      <div
        className="panel-grid"
        style={
          {
            '--panel-cols': 'minmax(0, 1.6fr) minmax(0, 1fr)',
            gap: 'var(--space-5)',
          } as CSSProperties
        }
      >
        <Card flush>
          <div style={{ padding: 'var(--space-5) var(--space-5) var(--space-3)' }}>
            <span className="skeleton skeleton-line skeleton-line--heading" />
          </div>
          <div style={{ padding: '0 var(--space-4) var(--space-3)' }}>
            {Array.from({ length: 4 }).map((_, index) => (
              <TransactionRowSkeleton key={index} />
            ))}
          </div>
        </Card>

        <Card>
          <span className="skeleton skeleton-line skeleton-line--heading" />
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              marginTop: 'var(--space-4)',
            }}
          >
            {Array.from({ length: 3 }).map((_, index) => (
              <AccountRowSkeleton key={index} />
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
