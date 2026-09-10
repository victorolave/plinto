import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service'
import { Invitation } from '../domain/invitation.entity'
import { InvitationRepository } from '../domain/invitation.repository'
import { MembershipRole } from '../../memberships/domain/membership.entity'

/**
 * Prisma adapter for the InvitationRepository port. This is the only unit that
 * knows about Prisma for the invitations aggregate; swapping ORMs means adding
 * a sibling adapter and rebinding the port in InvitationsModule.
 *
 * Every email crossing this boundary is lower-cased here rather than trusted
 * from the caller. The unique index on (tenant_id, email) only means "one
 * pending invitation per person" if the column holds one spelling per person,
 * and the database cannot enforce that itself — Prisma has no way to declare a
 * lower(email) index, and adding one by hand would show up as schema drift.
 */
@Injectable()
export class PrismaInvitationRepository extends InvitationRepository {
  constructor(private readonly prisma: PrismaService) {
    super()
  }

  async upsert(data: {
    tenantId: string
    email: string
    role: MembershipRole
    invitedByUserId: string
    expiresAt: Date
  }): Promise<Invitation> {
    const email = normalize(data.email)

    return this.prisma.invitation.upsert({
      where: { tenantId_email: { tenantId: data.tenantId, email } },
      create: {
        tenantId: data.tenantId,
        email,
        role: data.role,
        invitedByUserId: data.invitedByUserId,
        expiresAt: data.expiresAt,
      },
      // A re-invitation replaces the offer: new role, fresh clock, and the
      // person who most recently extended it. It does not stack.
      update: {
        role: data.role,
        invitedByUserId: data.invitedByUserId,
        expiresAt: data.expiresAt,
      },
    })
  }

  async listByTenantId(tenantId: string): Promise<Invitation[]> {
    return this.prisma.invitation.findMany({
      where: { tenantId },
      orderBy: [{ createdAt: 'asc' }, { email: 'asc' }],
    })
  }

  async listByEmail(email: string): Promise<Invitation[]> {
    return this.prisma.invitation.findMany({
      where: { email: normalize(email) },
      orderBy: { createdAt: 'asc' },
    })
  }

  async findById(id: string): Promise<Invitation | null> {
    return this.prisma.invitation.findUnique({ where: { id } })
  }

  async deleteByIdForTenant(id: string, tenantId: string): Promise<boolean> {
    // deleteMany, not delete: a delete on a non-matching id throws, and "this
    // invitation is not yours" must read as "not found", never as a 500.
    const result = await this.prisma.invitation.deleteMany({ where: { id, tenantId } })
    return result.count > 0
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await this.prisma.invitation.deleteMany({ where: { id } })
    return result.count > 0
  }
}

function normalize(email: string): string {
  return email.trim().toLowerCase()
}
