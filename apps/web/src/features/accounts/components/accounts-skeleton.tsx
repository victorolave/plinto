/**
 * Loading placeholder for the accounts page. Mirrors the real layout — a
 * currency section head plus a grid of account cards — so the transition to
 * loaded content is calm rather than a jump from a "Loading…" line.
 */

import { useTranslations } from 'next-intl'

function AccountCardSkeleton() {
  return (
    <div className="account-card account-card--skeleton" aria-hidden="true">
      <div className="account-card-head">
        <span className="skeleton skeleton-avatar" />
        <div className="account-card-id">
          <span className="skeleton skeleton-line skeleton-line--name" />
          <span className="skeleton skeleton-line skeleton-line--type" />
        </div>
      </div>
      <div className="account-card-balance">
        <span className="skeleton skeleton-line skeleton-line--eyebrow" />
        <span className="skeleton skeleton-line skeleton-line--amount" />
      </div>
    </div>
  )
}

export function AccountsSkeleton({ cards = 3 }: { cards?: number }) {
  const t = useTranslations('accounts')

  return (
    <div role="status" aria-label={t('loading')}>
      <section>
        <div className="section-head">
          <span className="skeleton skeleton-chip" />
          <span className="skeleton skeleton-line skeleton-line--heading" />
          <div className="section-total">
            <span className="skeleton skeleton-line skeleton-line--total" />
          </div>
        </div>

        <div className="account-grid">
          {Array.from({ length: cards }).map((_, index) => (
            <AccountCardSkeleton key={index} />
          ))}
        </div>
      </section>
    </div>
  )
}
