import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service'
import { CreditLine, CreditLineStatus } from '../domain/credit-line.entity'
import { CreditLineRepository } from '../domain/credit-line.repository'

/**
 * Prisma adapter for the CreditLineRepository port. This is the only unit that
 * knows about Prisma for the credit-lines aggregate.
 */
@Injectable()
export class PrismaCreditLineRepository extends CreditLineRepository {
  constructor(private readonly prisma: PrismaService) {
    super()
  }

  async create(data: {
    tenantId: string
    name: string
    limitMinor: number
    currency: string
  }): Promise<CreditLine> {
    return this.prisma.creditLine.create({ data })
  }

  async findByIdForTenant(id: string, tenantId: string): Promise<CreditLine | null> {
    return this.prisma.creditLine.findFirst({ where: { id, tenantId } })
  }

  async listForTenant(tenantId: string): Promise<CreditLine[]> {
    return this.prisma.creditLine.findMany({
      where: { tenantId },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    })
  }

  /**
   * Scoped by tenant in the same statement that writes, so a line belonging to
   * another household is a miss rather than an update — the check cannot be
   * skipped by a caller that forgot to make it.
   */
  async update(
    id: string,
    tenantId: string,
    data: { name?: string; limitMinor?: number },
  ): Promise<CreditLine | null> {
    const result = await this.prisma.creditLine.updateMany({ where: { id, tenantId }, data })

    if (result.count === 0) {
      return null
    }

    return this.findByIdForTenant(id, tenantId)
  }

  async setStatus(
    id: string,
    tenantId: string,
    status: CreditLineStatus,
  ): Promise<CreditLine | null> {
    const result = await this.prisma.creditLine.updateMany({
      where: { id, tenantId },
      data: { status },
    })

    if (result.count === 0) {
      return null
    }

    return this.findByIdForTenant(id, tenantId)
  }
}
