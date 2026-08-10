/**
 * Loading placeholder for a row of `StatCard`s.
 *
 * Four screens open with a stat grid — credit, debts, the dashboard and the
 * obligations board — so the placeholder for it lives here rather than being
 * re-typed in each. It mirrors `StatCard`'s real anatomy (label row, value,
 * delta caption) so the tiles do not change height when the figures land.
 */

export interface StatGridSkeletonProps {
  /** How many tiles to reserve. Match what the screen typically shows. */
  cards?: number
  /**
   * What is loading, for screen readers.
   *
   * Pass it when this grid is the only thing loading on the screen — it then
   * becomes its own `role="status"` region. OMIT it when the grid sits inside a
   * larger skeleton that already announces itself: nesting one live region
   * inside another makes assistive tech announce the same wait twice.
   */
  label?: string
}

export function StatGridSkeleton({ cards = 2, label }: StatGridSkeletonProps) {
  const announcement = label
    ? { role: 'status' as const, 'aria-label': label }
    : { 'aria-hidden': true as const }

  return (
    <div className="stat-grid" {...announcement}>
      {Array.from({ length: cards }).map((_, index) => (
        <div key={index} className="stat-card" aria-hidden="true">
          <div className="stat-card-top">
            <span className="skeleton skeleton-avatar" style={{ width: 28, height: 28 }} />
            <span className="skeleton skeleton-line" style={{ width: 96, height: 11 }} />
          </div>
          <span
            className="skeleton skeleton-line"
            style={{ width: '62%', height: 22, marginTop: 'var(--space-3)' }}
          />
          <span
            className="skeleton skeleton-line"
            style={{ width: '45%', height: 10, marginTop: 'var(--space-2)' }}
          />
        </div>
      ))}
    </div>
  )
}
