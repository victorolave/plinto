import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service'
import { Transaction, TransactionType, Transfer } from '../domain/transaction.entity'
import { TransactionRepository } from '../domain/transaction.repository'

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
  }): Promise<{ transfer: Transfer; debit: Transaction; credit: Transaction }> {
    return this.prisma.$transaction(async (tx) => {
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

      return { transfer: transferEntity, debit, credit }
    })
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

  async listByTenantId(
    tenantId: string,
    pagination?: { skip: number; take: number },
  ): Promise<Transaction[]> {
    return this.prisma.transaction.findMany({
      // Exclude transactions whose account has been archived: an archived
      // account is hidden everywhere, so its movements must not leak into the
      // tenant-wide list (or the balance computation that shares this query).
      // Restoring the account re-includes them, since the filter is dynamic.
      where: { tenantId, account: { archivedAt: null } },
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
      ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
    })
  }

  async listByAccountId(
    tenantId: string,
    accountId: string,
    pagination?: { skip: number; take: number },
  ): Promise<Transaction[]> {
    return this.prisma.transaction.findMany({
      where: { tenantId, accountId },
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
      ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
    })
  }

  async countByTenantId(tenantId: string): Promise<number> {
    // Same archived-account exclusion as listByTenantId so the reported total
    // matches what the list actually returns.
    return this.prisma.transaction.count({
      where: { tenantId, account: { archivedAt: null } },
    })
  }

  async countByAccountId(tenantId: string, accountId: string): Promise<number> {
    return this.prisma.transaction.count({
      where: { tenantId, accountId },
    })
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
