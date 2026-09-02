import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service'
import { Tenant } from '../domain/tenant.entity'
import { TenantRepository } from '../domain/tenant.repository'

/**
 * Prisma adapter for the TenantRepository port. This is the only unit that
 * knows about Prisma for the tenants aggregate; swapping ORMs means adding a
 * sibling adapter and rebinding the port in TenantsModule.
 */
@Injectable()
export class PrismaTenantRepository extends TenantRepository {
  constructor(private readonly prisma: PrismaService) {
    super()
  }

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

  async findDemoTenantForOwner(userId: string): Promise<Tenant | null> {
    return this.prisma.tenant.findFirst({
      where: {
        isDemo: true,
        memberships: { some: { userId, role: 'owner' } },
      },
    })
  }
}
