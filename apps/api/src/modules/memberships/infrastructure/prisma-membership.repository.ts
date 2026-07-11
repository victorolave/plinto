import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service'
import { Membership, MembershipRole } from '../domain/membership.entity'
import { MembershipRepository } from '../domain/membership.repository'

/**
 * Prisma adapter for the MembershipRepository port. This is the only unit
 * that knows about Prisma for the memberships aggregate; swapping ORMs
 * means adding a sibling adapter and rebinding the port in
 * MembershipsModule.
 */
@Injectable()
export class PrismaMembershipRepository extends MembershipRepository {
  constructor(private readonly prisma: PrismaService) {
    super()
  }

  async create(data: {
    tenantId: string
    userId: string
    role: MembershipRole
  }): Promise<Membership> {
    return this.prisma.membership.create({ data })
  }

  async listByUserId(userId: string): Promise<Membership[]> {
    return this.prisma.membership.findMany({ where: { userId } })
  }

  async isMember(userId: string, tenantId: string): Promise<boolean> {
    const membership = await this.prisma.membership.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
    })
    return Boolean(membership)
  }

  async findByUserAndTenant(userId: string, tenantId: string): Promise<Membership | null> {
    return this.prisma.membership.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
    })
  }
}
