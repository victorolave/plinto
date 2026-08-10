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
  // Separate from `members`: an invitation is not a membership yet, and only an
  // owner can read the list, so the two are fetched under different conditions.
  invitations: ['members', 'invitations'] as const,
  // Financed purchases. Their outstanding figure is derived from obligation
  // payments, so reconciling one invalidates this too.
  debts: ['debts'] as const,
  debtSummary: ['debts', 'summary'] as const,
  // Revolving credit. `creditSummary` carries each line's latest statement, so
  // recording one invalidates it as well as the line list.
  creditLines: ['credit-lines'] as const,
  creditSummary: ['credit-lines', 'summary'] as const,
  // Keyed by line: two lines are distinct result sets, and a household with
  // four cards must not serve one card's statements for another.
  creditStatements: (creditLineId: string) =>
    ['credit-lines', creditLineId, 'statements'] as const,
} as const
