import { Injectable, Logger } from '@nestjs/common'
import { SESSION_TTL_MINUTES } from '../../../config/constants'
import { MembershipRepository } from '../../memberships/domain/membership.repository'
import { SessionRepository } from '../../sessions/domain/session.repository'
import { UserRepository } from '../../users/domain/user.repository'
import { UserProvisioningService } from '../../users/application/user-provisioning.service'
import { InvitationService } from '../../invitations/application/invitation.service'

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(
    private readonly userProvisioningService: UserProvisioningService,
    private readonly userRepository: UserRepository,
    private readonly membershipRepository: MembershipRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly invitationService: InvitationService,
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
      user = await this.userRepository.updateName(user.id, params.name)
    }

    // Claimed BEFORE memberships are listed, so a household somebody was
    // invited to is already theirs by the time this session reports which
    // households they belong to — and, when it is their only one, by the time
    // the active tenant is chosen below. Listing first would show them nothing
    // and send them to onboarding to create a household they were just given.
    //
    // Never allowed to break a login: an invitation that cannot be claimed is a
    // household somebody cannot enter, but a throw here is a person who cannot
    // sign in at all.
    try {
      const claimed = await this.invitationService.claimFor(user, {
        correlationId: `session:${user.id}`,
      })
      if (claimed.length > 0) {
        this.logger.log(`Claimed ${claimed.length} invitation(s) for ${user.id}`)
      }
    } catch (error) {
      this.logger.error(`Failed to claim invitations for ${user.id}: ${error}`)
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
