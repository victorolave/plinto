import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service'
import { Tenant } from '../domain/tenant.entity'

@Injectable()
export class TenantRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    name: string
    baseCurrency: string
  }): Promise<Tenant> {
    return this.prisma.tenant.create({ data })
  }

  async findById(id: string): Promise<Tenant | null> {
    return this.prisma.tenant.findUnique({ where: { id } })
  }

  async listByUserId(userId: string): Promise<Tenant[]> {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      include: { tenant: true },
    })
    return memberships.map((membership) => membership.tenant)
  }
}
