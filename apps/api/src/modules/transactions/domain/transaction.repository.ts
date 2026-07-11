import { Transaction, TransactionType, Transfer } from './transaction.entity'

/**
 * Port: the transaction persistence contract the application layer depends on.
 * Adapters (e.g. PrismaTransactionRepository) live in the infrastructure layer
 * and implement this abstract class, which doubles as the DI token — so the
 * ORM can be swapped by binding a different adapter without touching business
 * logic.
 */
export abstract class TransactionRepository {
  abstract create(data: {
    tenantId: string
    accountId: string
    type: TransactionType
    amountMinor: number
    currency: string
    description: string | null
    occurredAt: Date
    transferId?: string | null
    categoryId?: string | null
  }): Promise<Transaction>

  abstract createTransfer(input: {
    tenantId: string
    sourceAccountId: string
    destinationAccountId: string
    sourceAmountMinor: number
    destinationAmountMinor: number
    sourceCurrency: string
    destinationCurrency: string
    fxRate: string | null
    feeMinor: number | null
    rateSource: string | null
    description: string | null
    occurredAt: Date
  }): Promise<{ transfer: Transfer; debit: Transaction; credit: Transaction }>

  abstract findByIdForTenant(id: string, tenantId: string): Promise<Transaction | null>

  abstract updateForTenant(
    id: string,
    tenantId: string,
    data: Partial<{
      accountId: string
      type: TransactionType
      amountMinor: number
      currency: string
      description: string | null
      occurredAt: Date
      categoryId: string | null
    }>,
  ): Promise<Transaction | null>

  abstract listByTenantId(tenantId: string): Promise<Transaction[]>

  abstract listByAccountId(tenantId: string, accountId: string): Promise<Transaction[]>
}
