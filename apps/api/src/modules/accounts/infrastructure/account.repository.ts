import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service'
import { Account, AccountType } from '../domain/account.entity'

@Injectable()
export class AccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    tenantId: string
    name: string
    type: AccountType
    currency: string
  }): Promise<Account> {
    return this.prisma.account.create({ data })
  }

  async listByTenantId(
    tenantId: string,
    options: { includeArchived?: boolean } = {},
  ): Promise<Account[]> {
    return this.prisma.account.findMany({
      where: {
        tenantId,
        ...(options.includeArchived ? {} : { archivedAt: null }),
      },
      orderBy: { createdAt: 'asc' },
    })
  }

  async findByIdForTenant(id: string, tenantId: string): Promise<Account | null> {
    return this.prisma.account.findFirst({
      where: { id, tenantId },
    })
  }

  async updateForTenant(
    id: string,
    tenantId: string,
    data: { name?: string; type?: AccountType },
  ): Promise<Account | null> {
    const result = await this.prisma.account.updateMany({
      where: { id, tenantId },
      data,
    })

    if (result.count === 0) {
      return null
    }

    return this.findByIdForTenant(id, tenantId)
  }

  async archiveForTenant(
    id: string,
    tenantId: string,
    archivedAt: Date,
  ): Promise<Account | null> {
    const result = await this.prisma.account.updateMany({
      where: { id, tenantId, archivedAt: null },
      data: { archivedAt },
    })

    if (result.count === 0) {
      return null
    }

    return this.findByIdForTenant(id, tenantId)
  }

  async restoreForTenant(id: string, tenantId: string): Promise<Account | null> {
    const result = await this.prisma.account.updateMany({
      where: { id, tenantId, archivedAt: { not: null } },
      data: { archivedAt: null },
    })

    if (result.count === 0) {
      return null
    }

    return this.findByIdForTenant(id, tenantId)
  }
}
