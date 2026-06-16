export type AccountType = 'cash' | 'bank' | 'credit' | 'savings'

export interface Account {
  id: string
  tenantId: string
  name: string
  type: AccountType
  currency: string
  createdAt: Date
  updatedAt: Date
}
