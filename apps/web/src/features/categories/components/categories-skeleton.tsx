/**
 * Loading placeholder for the categories list. Reuses the shared `.skeleton`
 * shimmer and mirrors a category row (swatch + name + type badge).
 */

const RADIUS_XS = 'var(--radius-xs)'

export function CategoriesSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading categories">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="data-row" aria-hidden="true">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              minWidth: 0,
              flex: 1,
            }}
          >
            <span
              className="skeleton"
              style={{ width: 12, height: 12, borderRadius: RADIUS_XS, flexShrink: 0 }}
            />
            <span className="skeleton skeleton-line" style={{ width: '32%', height: 13 }} />
            <span
              className="skeleton skeleton-line"
              style={{ width: 56, height: 18, borderRadius: 'var(--radius-chip)' }}
            />
          </div>
          <span
            className="skeleton"
            style={{ width: 32, height: 32, borderRadius: 'var(--radius-control)' }}
          />
        </div>
      ))}
    </div>
  )
}
