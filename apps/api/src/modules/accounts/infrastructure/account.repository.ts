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

  async listByTenantId(tenantId: string): Promise<Account[]> {
    return this.prisma.account.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    })
  }
}
