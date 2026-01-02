import { Injectable, Logger } from '@nestjs/common'
import { SESSION_TTL_MINUTES } from '../../../config/constants'
import { MembershipRepository } from '../../memberships/infrastructure/membership.repository'
import { SessionRepository } from '../../sessions/infrastructure/session.repository'
import { UserRepository } from '../../users/infrastructure/user.repository'
import { UserProvisioningService } from '../../users/application/user-provisioning.service'

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(
    private readonly userProvisioningService: UserProvisioningService,
    private readonly userRepository: UserRepository,
    private readonly membershipRepository: MembershipRepository,
    private readonly sessionRepository: SessionRepository,
  ) {}

  async createSession(params: {
    idpSub: string
    email: string
    name?: string | null
    userAgent?: string | null
    ipAddress?: string | null
  }) {
    this.logger.log(`Creating session for ${params.email}`)
    
    let user
    try {
      user = await this.userProvisioningService.provisionUser({
        idpSub: params.idpSub,
        email: params.email,
        name: params.name ?? undefined,
      })
      this.logger.log(`User provisioned: ${user.id}`)
    } catch (error) {
      this.logger.error(`Failed to provision user: ${error}`)
      throw error
    }

    if (!user.name && params.name) {
      await this.userRepository.updateName(user.id, params.name)
    }

    let memberships
    try {
      memberships = await this.membershipRepository.listByUserId(user.id)
      this.logger.log(`Found ${memberships.length} memberships`)
    } catch (error) {
      this.logger.error(`Failed to list memberships: ${error}`)
      throw error
    }

    let lastActiveTenant
    try {
      lastActiveTenant = await this.sessionRepository.getActiveTenantByUserId(user.id)
    } catch (error) {
      this.logger.error(`Failed to get active tenant: ${error}`)
      throw error
    }

    const hasLastActive = lastActiveTenant
      ? memberships.some((membership) => membership.tenantId === lastActiveTenant)
      : false
    const activeTenantId = hasLastActive
      ? lastActiveTenant
      : memberships.length === 1
        ? memberships[0].tenantId
        : null

    const expiresAt = new Date(Date.now() + SESSION_TTL_MINUTES * 60 * 1000)
    
    let session
    try {
      session = await this.sessionRepository.create({
        userId: user.id,
        tenantId: activeTenantId ?? undefined,
        expiresAt,
        userAgent: params.userAgent ?? null,
        ipAddress: params.ipAddress ?? null,
      })
      this.logger.log(`Session created: ${session.id}`)
    } catch (error) {
      this.logger.error(`Failed to create session: ${error}`)
      throw error
    }

    return {
      session,
      user: {
        ...user,
        idpSub: user.idpSub,
      },
      memberships,
      activeTenantId,
      needsOnboarding: !user.name || memberships.length === 0,
    }
  }

  async revokeSession(sessionId: string) {
    this.logger.log(`Revoking session: ${sessionId}`)
    try {
      await this.sessionRepository.revoke(sessionId)
      this.logger.log(`Session revoked successfully: ${sessionId}`)
    } catch (error) {
      this.logger.error(`Failed to revoke session ${sessionId}: ${error}`)
      throw error
    }
  }
}
