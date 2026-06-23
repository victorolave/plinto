import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service'
import { Category } from '../domain/category.entity'
import { TransactionType } from '../../transactions/domain/transaction.entity'

@Injectable()
export class CategoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    tenantId: string
    name: string
    type: TransactionType
    color?: string | null
  }): Promise<Category> {
    return this.prisma.category.create({ data })
  }

  async listByTenantId(tenantId: string): Promise<Category[]> {
    return this.prisma.category.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    })
  }

  async findByIdForTenant(id: string, tenantId: string): Promise<Category | null> {
    return this.prisma.category.findFirst({
      where: { id, tenantId },
    })
  }

  async updateForTenant(
    id: string,
    tenantId: string,
    data: Partial<{ name: string; color: string | null }>,
  ): Promise<Category | null> {
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.category.updateMany({
        where: { id, tenantId },
        data,
      })

      if (result.count === 0) {
        return null
      }

      return tx.category.findFirst({ where: { id, tenantId } })
    })
  }

  async deleteForTenant(id: string, tenantId: string): Promise<number> {
    const result = await this.prisma.category.deleteMany({
      where: { id, tenantId },
    })
    return result.count
  }
}
