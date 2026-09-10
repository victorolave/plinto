import { Transaction, TransactionType, Transfer } from './transaction.entity'

/**
 * Port: the transaction persistence contract the application layer depends on.
 * Adapters (e.g. PrismaTransactionRepository) live in the infrastructure layer
 * and implement this abstract class, which doubles as the DI token — so the
 * ORM can be swapped by binding a different adapter without touching business
 * logic.
 */
/**
 * How a caller narrows the ledger. Dates are calendar days (`YYYY-MM-DD`)
 * compared against the UTC date of `occurredAt`, matching how a row renders.
 */
export interface TransactionFilters {
  accountId?: string
  type?: TransactionType
  /** Inclusive lower bound, as a calendar day. */
  dateFrom?: string
  /** Inclusive upper bound, as a calendar day. */
  dateTo?: string
  /** Case-insensitive substring of the description or the account name. */
  search?: string
}

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

  /**
   * `idempotencyKey` is optional and client-supplied (the `Idempotency-Key`
   * header) — unrelated to `Transaction.idempotencyKey`, which the recurring
   * engine generates itself. When it collides with a prior transfer for the
   * same tenant, the adapter must resolve the conflict via the
   * `(tenantId, idempotencyKey)` unique index rather than a preceding read,
   * and report that in `alreadyExisted` so callers return `200` with the
   * original transfer instead of `201` with a new one.
   */
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
    idempotencyKey?: string | null
  }): Promise<{ transfer: Transfer; debit: Transaction; credit: Transaction; alreadyExisted: boolean }>

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

  /**
   * Narrowing the ledger. Every field is optional and absent means "no filter",
   * so `{}` is the whole household.
   *
   * These used to be applied in the browser over whatever had been fetched.
   * That is only defensible while the list is unpaginated: with pages, a
   * search that reads one page is not a search. `list` and `count` therefore
   * take the same filters, so the total shown beside a page always describes
   * the same rows the page came from.
   */
  abstract list(
    tenantId: string,
    filters: TransactionFilters,
    pagination?: { skip: number; take: number },
  ): Promise<Transaction[]>

  /**
   * Income and expense totals for `filters`, ignoring any `type` among them.
   *
   * The list's own total is a sum of these, so one aggregate serves both the
   * page count and the tab labels.
   */
  abstract countByType(
    tenantId: string,
    filters: TransactionFilters,
  ): Promise<{ income: number; expense: number }>

  /**
   * Aggregates signed movement totals per account and type in SQL, so balances
   * are computed by the database rather than by loading every transaction into
   * application memory. Excludes archived accounts, matching listByTenantId.
   */
  abstract sumByAccount(
    tenantId: string,
  ): Promise<Array<{ accountId: string; type: TransactionType; totalMinor: number }>>
}
