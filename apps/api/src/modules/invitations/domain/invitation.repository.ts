import { Invitation } from './invitation.entity'
import { MembershipRole } from '../../memberships/domain/membership.entity'

/**
 * Port: the invitation persistence contract the application layer depends on.
 * Adapters (e.g. PrismaInvitationRepository) live in the infrastructure layer
 * and implement this abstract class, which doubles as the DI token — so the ORM
 * can be swapped by binding a different adapter without touching business
 * logic.
 */
export abstract class InvitationRepository {
  /**
   * Creates the invitation, or updates the pending one that already exists for
   * this (tenant, email) — re-inviting somebody is how a person corrects a role
   * they picked wrong, and it should not require revoking first.
   */
  abstract upsert(data: {
    tenantId: string
    email: string
    role: MembershipRole
    invitedByUserId: string
    expiresAt: Date
  }): Promise<Invitation>

  abstract listByTenantId(tenantId: string): Promise<Invitation[]>

  /** Every household that has invited this address, across all tenants. */
  abstract listByEmail(email: string): Promise<Invitation[]>

  abstract findById(id: string): Promise<Invitation | null>

  /**
   * Deletes by id, scoped to a tenant so one household can never revoke
   * another's invitation by guessing an id. Returns false when nothing matched.
   */
  abstract deleteByIdForTenant(id: string, tenantId: string): Promise<boolean>

  abstract deleteById(id: string): Promise<boolean>
}
