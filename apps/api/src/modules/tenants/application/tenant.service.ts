import { Injectable } from '@nestjs/common'
import { TenantRepository } from '../domain/tenant.repository'
import { MembershipRepository } from '../../memberships/domain/membership.repository'
import { Tenant } from '../domain/tenant.entity'
import { Membership } from '../../memberships/domain/membership.entity'

@Injectable()
export class TenantService {
  constructor(
    private readonly tenantRepository: TenantRepository,
    private readonly membershipRepository: MembershipRepository,
  ) {}

  async listTenantsForUser(
    userId: string,
  ): Promise<{ tenants: Tenant[]; memberships: Membership[] }> {
    const tenants = await this.tenantRepository.listByUserId(userId)
    const memberships = await this.membershipRepository.listByUserId(userId)

    return { tenants, memberships }
  }
}
