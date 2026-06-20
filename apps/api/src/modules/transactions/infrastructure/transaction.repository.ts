import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service'
import { Transaction, TransactionType } from '../domain/transaction.entity'

@Injectable()
export class TransactionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    tenantId: string
    accountId: string
    type: TransactionType
    amountMinor: number
    currency: string
    description: string | null
    occurredAt: Date
  }): Promise<Transaction> {
    return this.prisma.transaction.create({ data })
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

  async listByTenantId(tenantId: string): Promise<Transaction[]> {
    return this.prisma.transaction.findMany({
      where: { tenantId },
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
    })
  }

  async listByAccountId(tenantId: string, accountId: string): Promise<Transaction[]> {
    return this.prisma.transaction.findMany({
      where: { tenantId, accountId },
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
    })
  }
}
