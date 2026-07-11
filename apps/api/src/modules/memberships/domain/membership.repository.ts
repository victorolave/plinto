import { Membership, MembershipRole } from './membership.entity'

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

  abstract isMember(userId: string, tenantId: string): Promise<boolean>

  abstract findByUserAndTenant(userId: string, tenantId: string): Promise<Membership | null>
}
