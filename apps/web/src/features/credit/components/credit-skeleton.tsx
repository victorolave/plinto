/**
 * Loading placeholders for the credit page.
 *
 * The panel used to render nothing at all while it loaded — the totals grid is
 * hidden until there are totals, and the list card until there are rows, so the
 * only thing on screen was the word "Loading…" beside the Add button.
 *
 * These are exported as two pieces rather than one block on purpose: the page
 * puts its "N credit lines open" header BETWEEN the totals and the list, so a
 * single combined skeleton would render both above the header and the content
 * would then jump around it once loaded. Each piece stands exactly where the
 * thing it stands in for will appear.
 */

import { useTranslations } from 'next-intl'
import { Card } from '../../../components/ui/card'

function CreditRowSkeleton() {
  return (
    <li className="data-row" aria-hidden="true">
      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
        <span className="skeleton skeleton-line" style={{ width: '32%', height: 14 }} />
        <span
          className="skeleton skeleton-line"
          style={{ width: '58%', height: 11, marginTop: 'var(--space-2)' }}
        />
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <span className="skeleton skeleton-line" style={{ width: 92, height: 16 }} />
        <span
          className="skeleton skeleton-line"
          style={{ width: 64, height: 28, borderRadius: 'var(--radius-control)' }}
        />
      </span>
    </li>
  )
}

/** The card of credit-line rows. Carries the page's loading announcement. */
export function CreditListSkeleton({ rows = 3 }: { rows?: number }) {
  const t = useTranslations('credit')

  return (
    <Card flush>
      <ul className="member-list" role="status" aria-label={t('loading')}>
        {Array.from({ length: rows }).map((_, index) => (
          <CreditRowSkeleton key={index} />
        ))}
      </ul>
    </Card>
  )
}
