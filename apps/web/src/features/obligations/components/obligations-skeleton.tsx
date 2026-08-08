/**
 * Loading placeholder for the obligations board. Reuses the shared `.skeleton`
 * shimmer and mirrors an obligation row (name + due date, amount, status).
 */

export function ObligationsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading obligations">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="data-row" aria-hidden="true">
          <div style={{ minWidth: 0, flex: 1 }}>
            <span className="skeleton skeleton-line" style={{ width: '38%', height: 13 }} />
            <span
              className="skeleton skeleton-line"
              style={{ width: '24%', height: 11, marginTop: 'var(--space-2)' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <span className="skeleton skeleton-line" style={{ width: 84, height: 14 }} />
            <span
              className="skeleton skeleton-line"
              style={{ width: 60, height: 18, borderRadius: 'var(--radius-chip)' }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
