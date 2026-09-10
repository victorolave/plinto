import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service'
import { Transaction, TransactionType, Transfer } from '../domain/transaction.entity'
import { TransactionFilters, TransactionRepository } from '../domain/transaction.repository'

/**
 * Prisma adapter for the TransactionRepository port. This is the only unit
 * that knows about Prisma for the transactions aggregate; swapping ORMs
 * means adding a sibling adapter and rebinding the port in
 * TransactionsModule.
 */
@Injectable()
export class PrismaTransactionRepository extends TransactionRepository {
  constructor(private readonly prisma: PrismaService) {
    super()
  }

  async create(data: {
    tenantId: string
    accountId: string
    type: TransactionType
    amountMinor: number
    currency: string
    description: string | null
    occurredAt: Date
    transferId?: string | null
    categoryId?: string | null
  }): Promise<Transaction> {
    return this.prisma.transaction.create({ data })
  }

  /**
   * `idempotencyKey` (when present) is enforced by the `(tenantId,
   * idempotencyKey)` unique index on `transfers`, not by checking first: the
   * insert is attempted directly, and a `P2002` on that index — a concurrent
   * retry that won the race — is caught below and resolved by loading what
   * the winner created. A `findFirst`-then-insert check would let two
   * concurrent retries both pass the check before either writes, which is
   * exactly the double-transfer bug this closes.
   */
  async createTransfer(input: {
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
  }): Promise<{ transfer: Transfer; debit: Transaction; credit: Transaction; alreadyExisted: boolean }> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const transfer = await tx.transfer.create({
          data: {
            tenantId: input.tenantId,
            sourceAccountId: input.sourceAccountId,
            destinationAccountId: input.destinationAccountId,
            sourceAmountMinor: input.sourceAmountMinor,
            destinationAmountMinor: input.destinationAmountMinor,
            sourceCurrency: input.sourceCurrency,
            destinationCurrency: input.destinationCurrency,
            fxRate: input.fxRate ?? undefined,
            feeMinor: input.feeMinor ?? undefined,
            rateSource: input.rateSource ?? undefined,
            idempotencyKey: input.idempotencyKey ?? undefined,
          },
        })

        const debit = await tx.transaction.create({
          data: {
            tenantId: input.tenantId,
            accountId: input.sourceAccountId,
            type: 'expense',
            amountMinor: input.sourceAmountMinor,
            currency: input.sourceCurrency,
            description: input.description,
            occurredAt: input.occurredAt,
            transferId: transfer.id,
          },
        })

        const credit = await tx.transaction.create({
          data: {
            tenantId: input.tenantId,
            accountId: input.destinationAccountId,
            type: 'income',
            amountMinor: input.destinationAmountMinor,
            currency: input.destinationCurrency,
            description: input.description,
            occurredAt: input.occurredAt,
            transferId: transfer.id,
          },
        })

        const transferEntity: Transfer = {
          ...transfer,
          fxRate: transfer.fxRate != null ? transfer.fxRate.toString() : null,
        }

        return { transfer: transferEntity, debit, credit, alreadyExisted: false }
      })
    } catch (error) {
      const existing = input.idempotencyKey
        ? await this.findTransferByIdempotencyKey(input.tenantId, input.idempotencyKey, error)
        : null

      if (existing) {
        return { ...existing, alreadyExisted: true }
      }

      throw error
    }
  }

  /**
   * Resolves the "already exists" side of `createTransfer`'s race: only
   * treats `error` as "someone else just created this" when it is the
   * specific unique-constraint violation (`P2002`) Prisma raises for the
   * `(tenantId, idempotencyKey)` index — anything else (a bad FK, a closed
   * connection) is a real failure and must keep propagating, not get
   * swallowed into a false "already exists".
   */
  private async findTransferByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
    error: unknown,
  ): Promise<{ transfer: Transfer; debit: Transaction; credit: Transaction } | null> {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
      return null
    }

    const transfer = await this.prisma.transfer.findFirst({
      where: { tenantId, idempotencyKey },
    })
    if (!transfer) return null

    const legs = await this.prisma.transaction.findMany({
      where: { transferId: transfer.id },
    })
    const debit = legs.find((leg) => leg.type === 'expense')
    const credit = legs.find((leg) => leg.type === 'income')
    if (!debit || !credit) return null

    return {
      transfer: {
        ...transfer,
        fxRate: transfer.fxRate != null ? transfer.fxRate.toString() : null,
      },
      debit,
      credit,
    }
  }

  async findByIdForTenant(id: string, tenantId: string): Promise<Transaction | null> {
    return this.prisma.transaction.findFirst({
      where: { id, tenantId },
    })
  }

  async updateForTenant(
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
  ): Promise<Transaction | null> {
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.transaction.updateMany({
        where: { id, tenantId },
        data,
      })

      if (result.count === 0) {
        return null
      }

      // Re-read inside the same transaction so the audit `after` snapshot
      // reflects this update, not a concurrent PATCH that landed in between.
      return tx.transaction.findFirst({ where: { id, tenantId } })
    })
  }

  /**
   * The one place the ledger's filters become SQL.
   *
   * It existed as four near-identical methods before, each repeating the
   * archived-account exclusion; a filter added to one and forgotten in another
   * would have reported a total that did not match its own page. Building the
   * clause once makes that drift impossible rather than merely unlikely.
   */
  private whereFor(
    tenantId: string,
    filters: TransactionFilters,
  ): Prisma.TransactionWhereInput {
    const where: Prisma.TransactionWhereInput = {
      tenantId,
      // Exclude transactions whose account has been archived: an archived
      // account is hidden everywhere, so its movements must not leak into the
      // tenant-wide list. Restoring the account re-includes them, since the
      // filter is dynamic.
      account: { archivedAt: null },
    }

    if (filters.accountId) where.accountId = filters.accountId
    if (filters.type) where.type = filters.type

    // Whole UTC days, inclusive at both ends. The browser filter compared the
    // UTC date slice of `occurredAt`, and anchoring these bounds to the
    // server's zone instead would silently shift the range by a day.
    if (filters.dateFrom || filters.dateTo) {
      where.occurredAt = {
        ...(filters.dateFrom ? { gte: new Date(`${filters.dateFrom}T00:00:00.000Z`) } : {}),
        ...(filters.dateTo ? { lte: new Date(`${filters.dateTo}T23:59:59.999Z`) } : {}),
      }
    }

    // Description *and* account name, because that is what the browser filter
    // searched: narrowing it here would return fewer rows for the same term
    // than the unpaginated list used to.
    if (filters.search) {
      where.OR = [
        { description: { contains: filters.search, mode: 'insensitive' } },
        { account: { name: { contains: filters.search, mode: 'insensitive' } } },
      ]
    }

    return where
  }

  async list(
    tenantId: string,
    filters: TransactionFilters,
    pagination?: { skip: number; take: number },
  ): Promise<Transaction[]> {
    return this.prisma.transaction.findMany({
      where: this.whereFor(tenantId, filters),
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
      ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
    })
  }

  /**
   * How many income and expense rows the filters match, ignoring any type
   * filter among them.
   *
   * One aggregate answers two questions: it labels the income/expense tabs,
   * and the page total is a sum of its parts, so no separate count query is
   * needed. The type filter is dropped on purpose — the tabs are what sets it,
   * and counting through it would report zero for every tab but the open one.
   */
  async countByType(
    tenantId: string,
    filters: TransactionFilters,
  ): Promise<{ income: number; expense: number }> {
    const withoutType: TransactionFilters = { ...filters }
    delete withoutType.type

    const rows = await this.prisma.transaction.groupBy({
      by: ['type'],
      where: this.whereFor(tenantId, withoutType),
      _count: { _all: true },
    })

    // Absent groups are zero, not missing: a household with no income at all
    // still has an income tab to label.
    const counts = { income: 0, expense: 0 }
    for (const row of rows) {
      counts[row.type as TransactionType] = row._count._all
    }
    return counts
  }

  async sumByAccount(
    tenantId: string,
  ): Promise<Array<{ accountId: string; type: TransactionType; totalMinor: number }>> {
    const rows = await this.prisma.transaction.groupBy({
      by: ['accountId', 'type'],
      // Same archived-account exclusion as listByTenantId so balances and the
      // ledger stay consistent.
      where: { tenantId, account: { archivedAt: null } },
      _sum: { amountMinor: true },
    })

    return rows.map((row) => ({
      accountId: row.accountId,
      type: row.type as TransactionType,
      totalMinor: row._sum.amountMinor ?? 0,
    }))
  }
}
