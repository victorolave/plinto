/**
 * Central registry of React Query cache keys. Keeping them in one place keeps
 * fetch sites and their invalidations in sync — a mutation invalidates the same
 * key a query reads, so shared resources refresh consistently across pages.
 */
export const queryKeys = {
  me: ['me'] as const,
  categories: ['categories'] as const,
  accounts: (includeArchived = false) => ['accounts', { includeArchived }] as const,
  balances: ['balances'] as const,
  transactions: (accountId?: string) => ['transactions', { accountId: accountId ?? null }] as const,
  // Separate key from `transactions()`: the dashboard only loads a small page
  // (pageSize: 6) for the "recent activity" widget, while `transactions()` loads
  // up to 100 rows for the ledger panel. Sharing one key would let a 30s-stale
  // cache entry from either page silently serve the other page's smaller/larger
  // result set.
  recentTransactions: ['transactions', 'recent'] as const,
  recurringRules: ['recurring-rules'] as const,
  // Keyed by period: the board switches months, and each month is a distinct
  // result set that must not serve another month's cache entry.
  obligations: (period: string) => ['obligations', { period }] as const,
  obligationSummary: (period: string) =>
    ['obligations', 'summary', { period }] as const,
  tenants: ['tenants'] as const,
  // Not keyed by tenant: the API resolves the household from the session, and
  // switching households reloads the page (see DashboardShell), so no stale
  // entry from a previous tenant can survive to serve this key.
  members: ['members'] as const,
} as const
