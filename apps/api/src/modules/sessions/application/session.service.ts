import { Injectable } from '@nestjs/common'
import { MembershipRepository } from '../../memberships/infrastructure/membership.repository'
import { SessionRepository } from '../infrastructure/session.repository'

@Injectable()
export class SessionService {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly membershipRepository: MembershipRepository,
  ) {}

  async getActiveTenant(userId: string): Promise<string | null> {
    return this.sessionRepository.getActiveTenantByUserId(userId)
  }

  async setActiveTenant(userId: string, tenantId: string | null) {
    return this.sessionRepository.updateActiveTenantForUser(userId, tenantId)
  }

  async autoSelectIfSingleTenant(userId: string): Promise<string | null> {
    const memberships = await this.membershipRepository.listByUserId(userId)
    if (memberships.length === 1) {
      const tenantId = memberships[0].tenantId
      await this.setActiveTenant(userId, tenantId)
      return tenantId
    }
    return null
  }
}
