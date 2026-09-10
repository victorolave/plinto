import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service'

/** The transaction-scoped client Prisma hands to an interactive transaction. */
type TransactionClient = Parameters<Parameters<PrismaService['$transaction']>[0]>[0]
import {
  Membership,
  MembershipRole,
  MembershipWriteOutcome,
  TenantMember,
} from '../domain/membership.entity'
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

  async updateRole(params: {
    tenantId: string
    userId: string
    role: MembershipRole
  }): Promise<MembershipWriteOutcome> {
    return this.prisma.$transaction(async (tx) => {
      const membership = await lockAndFind(tx, params.tenantId, params.userId)
      if (!membership) {
        return 'not_found'
      }

      // Only a demotion can orphan a household. Promoting somebody, or setting
      // the role they already hold, never reduces the owner count.
      if (membership.role === 'owner' && params.role !== 'owner') {
        if (await isLastOwner(tx, params.tenantId)) {
          return 'would_orphan'
        }
      }

      await tx.membership.update({
        where: { tenantId_userId: { tenantId: params.tenantId, userId: params.userId } },
        data: { role: params.role },
      })

      return 'ok'
    })
  }

  async remove(params: {
    tenantId: string
    userId: string
  }): Promise<MembershipWriteOutcome> {
    return this.prisma.$transaction(async (tx) => {
      const membership = await lockAndFind(tx, params.tenantId, params.userId)
      if (!membership) {
        return 'not_found'
      }

      if (membership.role === 'owner' && (await isLastOwner(tx, params.tenantId))) {
        return 'would_orphan'
      }

      await tx.membership.delete({
        where: { tenantId_userId: { tenantId: params.tenantId, userId: params.userId } },
      })

      return 'ok'
    })
  }
}

/**
 * Takes a row lock over every membership of the household before reading one.
 *
 * Without it the last-owner guard is decorative: two owners demoting each other
 * at the same moment would both read a count of two, both pass, and leave the
 * household with none. The lock is over the whole tenant rather than the single
 * row because the count that has to stay true spans all of them.
 */
async function lockAndFind(
  tx: TransactionClient,
  tenantId: string,
  userId: string,
): Promise<{ role: MembershipRole } | null> {
  await tx.$queryRaw`SELECT "id" FROM "memberships" WHERE "tenant_id" = ${tenantId} FOR UPDATE`

  return tx.membership.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
    select: { role: true },
  })
}

async function isLastOwner(tx: TransactionClient, tenantId: string): Promise<boolean> {
  const owners = await tx.membership.count({ where: { tenantId, role: 'owner' } })
  return owners <= 1
}
