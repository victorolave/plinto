import { useTranslations } from 'next-intl'

/** A page number to render, or an elided stretch of them. */
export type PageWindowEntry = number | 'gap'

/**
 * Below this many pages every number is drawn. An ellipsis that hides one or
 * two pages costs the same width as the pages it hides and buys nothing.
 */
const SHOW_EVERY_PAGE_UP_TO = 7

/**
 * Which page numbers to draw for `page` of `totalPages`.
 *
 * The rule is: the first page, the last page, and the current one with a
 * neighbour on each side, are always reachable in a single click. Whatever
 * falls between those groups collapses to a `'gap'` — unless the gap would
 * hide exactly one page, in which case the page itself is drawn. Hiding one
 * number behind an ellipsis of the same width is pure loss.
 *
 * Exported because this elision rule is the only real logic in the component,
 * and an off-by-one here should fail as an array mismatch rather than as a
 * missing button somewhere in the DOM.
 */
export function pageWindow(page: number, totalPages: number): PageWindowEntry[] {
  if (totalPages <= SHOW_EVERY_PAGE_UP_TO) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const anchors = new Set<number>([1, totalPages])
  for (const candidate of [page - 1, page, page + 1]) {
    if (candidate >= 1 && candidate <= totalPages) anchors.add(candidate)
  }

  const ordered = [...anchors].sort((left, right) => left - right)
  const entries: PageWindowEntry[] = []

  ordered.forEach((current, index) => {
    const previous = ordered[index - 1]
    if (previous !== undefined) {
      const skipped = current - previous - 1
      if (skipped === 1) entries.push(previous + 1)
      else if (skipped > 1) entries.push('gap')
    }
    entries.push(current)
  })

  return entries
}

export interface PaginationProps {
  /** 1-based, matching `PaginationQuerySchema`. */
  page: number
  pageSize: number
  /** Rows in the whole collection, not on this page. */
  total: number
  onPageChange: (page: number) => void
}

/**
 * Page navigation for a server-paginated list.
 *
 * Page-based rather than cursor-based on purpose: `PaginationMetaSchema`
 * already answers with `page`/`pageSize`/`total`/`totalPages`, so numbered
 * pages are what the contract can actually support. A ledger is also read by
 * jumping — "the end of last year" is a position, not a scroll distance.
 *
 * Renders nothing at all when the collection fits on one page, so a list can
 * mount this unconditionally without growing dead chrome in the common case.
 */
export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const t = useTranslations('pagination')
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  if (totalPages <= 1) return null

  const start = (page - 1) * pageSize + 1
  // The last page is short: reporting `page * pageSize` would claim rows that
  // are not there.
  const end = Math.min(page * pageSize, total)

  return (
    <nav className="pagination" aria-label={t('label')}>
      <p className="pagination-range muted">{t('range', { start, end, total })}</p>

      <div className="pagination-controls">
        <button
          type="button"
          className="pagination-step"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label={t('previous')}
        >
          ‹
        </button>

        {pageWindow(page, totalPages).map((entry, index) =>
          entry === 'gap' ? (
            <span
              key={`gap-${index}`}
              className="pagination-gap"
              aria-hidden="true"
            >
              …
            </span>
          ) : (
            <button
              key={entry}
              type="button"
              className={`pagination-page ${entry === page ? 'is-current' : ''}`.trim()}
              onClick={() => onPageChange(entry)}
              aria-current={entry === page ? 'page' : undefined}
              aria-label={t('goToPage', { page: entry })}
            >
              {entry}
            </button>
          ),
        )}

        <button
          type="button"
          className="pagination-step"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label={t('next')}
        >
          ›
        </button>
      </div>
    </nav>
  )
}
