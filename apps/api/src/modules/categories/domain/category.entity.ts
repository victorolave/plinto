import { TransactionType } from '../../transactions/domain/transaction.entity'

export interface Category {
  id: string
  tenantId: string
  name: string
  type: TransactionType
  color: string | null
  createdAt: Date
  updatedAt: Date
}
