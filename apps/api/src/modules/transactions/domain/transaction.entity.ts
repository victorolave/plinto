export type TransactionType = 'income' | 'expense'

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
}

export interface AccountBalance {
  accountId: string
  accountName: string
  currency: string
  balanceMinor: number
}
