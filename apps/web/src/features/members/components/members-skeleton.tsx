/**
 * Loading placeholder for the member list. Reuses the shared `.skeleton`
 * shimmer and mirrors a member row (avatar + name/email stack + role badge).
 */

export function MembersSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading members">
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
              style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0 }}
            />
            <span
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-1)',
                minWidth: 0,
                flex: 1,
              }}
            >
              <span className="skeleton skeleton-line" style={{ width: '28%', height: 13 }} />
              <span className="skeleton skeleton-line" style={{ width: '44%', height: 11 }} />
            </span>
          </div>
          <span
            className="skeleton skeleton-line"
            style={{ width: 60, height: 18, borderRadius: 'var(--radius-chip)' }}
          />
        </div>
      ))}
    </div>
  )
}
