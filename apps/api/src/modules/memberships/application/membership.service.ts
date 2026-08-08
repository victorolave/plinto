import { Injectable } from '@nestjs/common'
import { TenantMember } from '../domain/membership.entity'
import { MembershipRepository } from '../domain/membership.repository'

/**
 * Read and administration of who belongs to a household.
 *
 * Membership was until now a purely internal aggregate: the guards consumed it
 * to answer "may this request proceed", and the only writer was onboarding,
 * which grants the creator the `owner` role. This service is the first
 * user-facing surface over it.
 */
@Injectable()
export class MembershipService {
  constructor(private readonly membershipRepository: MembershipRepository) {}

  /**
   * Tenant-scoped by construction: the caller passes the tenant the guards
   * already resolved and verified membership in, so this can never read a
   * household the requester does not belong to.
   */
  async listMembers(tenantId: string): Promise<TenantMember[]> {
    return this.membershipRepository.listMembersByTenantId(tenantId)
  }
}
