import {
  Membership,
  MembershipRole,
  MembershipWriteOutcome,
  TenantMember,
} from './membership.entity'

/**
 * Port: the membership persistence contract the application layer depends
 * on. Adapters (e.g. PrismaMembershipRepository) live in the infrastructure
 * layer and implement this abstract class, which doubles as the DI token —
 * so the ORM can be swapped by binding a different adapter without touching
 * business logic.
 */
export abstract class MembershipRepository {
  abstract create(data: {
    tenantId: string
    userId: string
    role: MembershipRole
  }): Promise<Membership>

  abstract listByUserId(userId: string): Promise<Membership[]>

  /**
   * Every member of one household, with the identity behind each membership.
   * Ordering is the adapter's responsibility so the list is stable across
   * requests — an unordered member list reshuffles on every render.
   */
  abstract listMembersByTenantId(tenantId: string): Promise<TenantMember[]>

  abstract isMember(userId: string, tenantId: string): Promise<boolean>

  abstract findByUserAndTenant(userId: string, tenantId: string): Promise<Membership | null>

  /**
   * Changes a member's role, refusing the change that would leave the household
   * without an owner.
   *
   * The guard lives here rather than in the service because a check followed by
   * a separate write is not a guard at all: two concurrent demotions would each
   * see two owners and both proceed, leaving none. Only the adapter can hold
   * the read and the write in one transaction.
   */
  abstract updateRole(params: {
    tenantId: string
    userId: string
    role: MembershipRole
  }): Promise<MembershipWriteOutcome>

  /** Removes a member, under the same last-owner guard and for the same reason. */
  abstract remove(params: {
    tenantId: string
    userId: string
  }): Promise<MembershipWriteOutcome>
}
