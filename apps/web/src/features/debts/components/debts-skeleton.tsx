/**
 * Loading placeholders for the debts page.
 *
 * Same shape and same reason as the credit ones: the totals grid and the list
 * card are both conditional on having data, so the loading state was a bare
 * "Loading…" label on an otherwise empty page. Split in two so each piece sits
 * where its content will — the "N purchases in progress" header goes between
 * them.
 */

import { useTranslations } from 'next-intl'
import { Card } from '../../../components/ui/card'

function DebtRowSkeleton() {
  return (
    <li className="data-row" aria-hidden="true">
      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
        <span className="skeleton skeleton-line" style={{ width: '30%', height: 14 }} />
        <span
          className="skeleton skeleton-line"
          style={{ width: '46%', height: 11, marginTop: 'var(--space-2)' }}
        />
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <span className="skeleton skeleton-line" style={{ width: 88, height: 16 }} />
      </span>
    </li>
  )
}

/** The card of financed-purchase rows. Carries the page's loading announcement. */
export function DebtsListSkeleton({ rows = 3 }: { rows?: number }) {
  const t = useTranslations('debts')

  return (
    <Card flush>
      <ul className="member-list" role="status" aria-label={t('loading')}>
        {Array.from({ length: rows }).map((_, index) => (
          <DebtRowSkeleton key={index} />
        ))}
      </ul>
    </Card>
  )
}
