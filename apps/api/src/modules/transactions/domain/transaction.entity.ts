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
  source?: TransactionSource
  recurringRuleId?: string | null
  recurringPeriod?: string | null
  idempotencyKey?: string | null
}

export interface AccountBalance {
  accountId: string
  accountName: string
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
