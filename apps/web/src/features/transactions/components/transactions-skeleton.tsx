/**
 * Loading placeholders for the transactions view. Reuse the shared `.skeleton`
 * shimmer (see globals.css) and mirror the real layout — balance pills, ledger
 * rows, recurring rows — so the loaded content settles in without a jump.
 */

import { useTranslations } from 'next-intl'

const RADIUS_MD = 'var(--radius-control)'

export function BalanceStripSkeleton({ pills = 3 }: { pills?: number }) {
  return (
    <div className="balance-strip" aria-hidden="true">
      {Array.from({ length: pills }).map((_, index) => (
        <div key={index} className="balance-pill">
          <span className="skeleton skeleton-line" style={{ width: '58%', height: 9 }} />
          <span
            className="skeleton skeleton-line"
            style={{ width: '82%', height: 16, marginTop: 4 }}
          />
        </div>
      ))}
    </div>
  )
}

function TransactionRowSkeleton() {
  return (
    <div className="tx-row" aria-hidden="true">
      <span
        className="skeleton"
        style={{ width: 38, height: 38, borderRadius: RADIUS_MD, flexShrink: 0 }}
      />
      <div className="tx-main">
        <span className="skeleton skeleton-line" style={{ width: '42%', height: 13 }} />
        <span
          className="skeleton skeleton-line"
          style={{ width: '26%', height: 10, marginTop: 8 }}
        />
      </div>
      <span className="skeleton skeleton-line" style={{ width: 72, height: 14 }} />
    </div>
  )
}

export function TransactionListSkeleton({ rows = 6 }: { rows?: number }) {
  const t = useTranslations('transactions')

  return (
    <div role="status" aria-label={t('loading')}>
      {Array.from({ length: rows }).map((_, index) => (
        <TransactionRowSkeleton key={index} />
      ))}
    </div>
  )
}

export function RecurringListSkeleton({ rows = 2 }: { rows?: number }) {
  const t = useTranslations('transactions')

  return (
    <div role="status" aria-label={t('loadingRecurring')}>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="data-row" aria-hidden="true">
          <div style={{ minWidth: 0, flex: 1 }}>
            <span
              className="skeleton skeleton-line"
              style={{ width: '35%', height: 13 }}
            />
            <span
              className="skeleton skeleton-line"
              style={{ width: '22%', height: 10, marginTop: 8 }}
            />
          </div>
          <span className="skeleton skeleton-line" style={{ width: 64, height: 14 }} />
        </div>
      ))}
    </div>
  )
}
