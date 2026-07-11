/**
 * Central registry of React Query cache keys. Keeping them in one place keeps
 * fetch sites and their invalidations in sync — a mutation invalidates the same
 * key a query reads, so shared resources refresh consistently across pages.
 */
export const queryKeys = {
  categories: ['categories'] as const,
  accounts: (includeArchived = false) => ['accounts', { includeArchived }] as const,
  balances: ['balances'] as const,
  transactions: (accountId?: string) => ['transactions', { accountId: accountId ?? null }] as const,
  recurringRules: ['recurring-rules'] as const,
  tenants: ['tenants'] as const,
} as const
