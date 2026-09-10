import type { AccountType } from '../../accounts/domain/account.entity'
export type TransactionType = 'income' | 'expense'
export type TransactionSource = 'manual' | 'job'

export interface Transaction {
  id: string
  tenantId: string
  accountId: string
  type: TransactionType
  amountMinor: number
  currency: string
  description: string | null
  occurredAt: Date
  createdAt: Date
  updatedAt: Date
  transferId: string | null
  categoryId?: string | null
  source?: TransactionSource
  recurringRuleId?: string | null
  recurringPeriod?: string | null
  idempotencyKey?: string | null
}

export interface AccountBalance {
  accountId: string
  accountName: string
  /**
   * Travels with the balance so a caller can tell an asset from a liability
   * without fetching accounts separately and joining them by hand.
   */
  accountType: AccountType
  currency: string
  balanceMinor: number
}

export interface Transfer {
  id: string
  tenantId: string
  sourceAccountId: string
  destinationAccountId: string
  sourceAmountMinor: number
  destinationAmountMinor: number
  sourceCurrency: string
  destinationCurrency: string
  fxRate: string | null  // decimal string, never Prisma.Decimal
  feeMinor: number | null
  rateSource: string | null
  createdAt: Date
  updatedAt: Date
}
