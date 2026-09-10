/**
 * Kept in step with `AccountTypeSchema` in @plinto/shared and with the
 * `AccountType` enum in schema.prisma. `debt` is a liability — see
 * `isLiabilityAccountType`, which is the single place that answers which of
 * these represent money owed rather than money held.
 */
export type AccountType = 'cash' | 'bank' | 'credit' | 'savings' | 'debt'

export interface Account {
  id: string
  tenantId: string
  name: string
  type: AccountType
  currency: string
  createdAt: Date
  updatedAt: Date
  archivedAt: Date | null
}
