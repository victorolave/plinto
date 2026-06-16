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
