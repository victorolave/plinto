import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service'
import { Membership, MembershipRole, TenantMember } from '../domain/membership.entity'
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

  /**
   * Ordered by join date, then email: the household reads chronologically —
   * the owner who created it first, whoever joined after — and email breaks
   * the tie for members created in the same transaction, which `createdAt`
   * alone cannot do. Without the tiebreak Postgres is free to return equal
   * timestamps in any order, and the list would reshuffle between renders.
   */
  async listMembersByTenantId(tenantId: string): Promise<TenantMember[]> {
    const memberships = await this.prisma.membership.findMany({
      where: { tenantId },
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: [{ createdAt: 'asc' }, { user: { email: 'asc' } }],
    })

    return memberships.map((membership) => ({
      userId: membership.user.id,
      email: membership.user.email,
      name: membership.user.name,
      role: membership.role,
      joinedAt: membership.createdAt,
    }))
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
