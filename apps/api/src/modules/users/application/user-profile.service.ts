import { Injectable, NotFoundException } from '@nestjs/common'
import { UserRepository } from '../domain/user.repository'
import { AuditService } from '../../audit/application/audit.service'
import { SessionService } from '../../sessions/application/session.service'
import { User } from '../domain/user.entity'

const USER_NOT_FOUND = {
  code: 'USER_NOT_FOUND',
  message: 'User not found',
} as const

@Injectable()
export class UserProfileService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly auditService: AuditService,
    private readonly sessionService: SessionService,
  ) {}

  async getProfile(userId: string): Promise<User | null> {
    return this.userRepository.findById(userId)
  }

  async updateProfile(params: {
    userId: string
    name: string
    correlationId: string
  }): Promise<User> {
    const existing = await this.userRepository.findById(params.userId)

    if (!existing) {
      throw new NotFoundException(USER_NOT_FOUND)
    }

    const updated = await this.userRepository.updateName(params.userId, params.name)

    // `/me` is not tenant-scoped (no TenantGuard), so there is no
    // `RequestContext.tenantId` to attach this event to. Resolve the actor's
    // active tenant instead — the same source `GET /me` already uses to
    // report `activeTenantId`. A user who hasn't joined/selected a tenant
    // yet has no audit trail to record against, so recording is skipped.
    const tenantId = await this.sessionService.getActiveTenant(params.userId)

    if (tenantId) {
      await this.auditService.record({
        tenantId,
        actorUserId: params.userId,
        action: 'user.profile.updated',
        resourceType: 'user',
        resourceId: updated.id,
        correlationId: params.correlationId,
        metadata: {
          before: { name: existing.name },
          after: { name: updated.name },
        },
      })
    }

    return updated
  }

  /**
   * Idempotent: the timestamp is stamped only the first time. A tour replayed
   * from the help button must not touch it again — "first login" has to stay
   * true regardless of how many times the tour is later re-run.
   */
  async markOnboardingTourSeen(params: {
    userId: string
    correlationId: string
  }): Promise<User> {
    const existing = await this.userRepository.findById(params.userId)

    if (!existing) {
      throw new NotFoundException(USER_NOT_FOUND)
    }

    if (existing.onboardingTourSeenAt) {
      return existing
    }

    const updated = await this.userRepository.markOnboardingTourSeen(params.userId)

    const tenantId = await this.sessionService.getActiveTenant(params.userId)

    if (tenantId) {
      await this.auditService.record({
        tenantId,
        actorUserId: params.userId,
        action: 'user.onboarding_tour.seen',
        resourceType: 'user',
        resourceId: updated.id,
        correlationId: params.correlationId,
        metadata: null,
      })
    }

    return updated
  }
}
