import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { AuditService } from '../../audit/application/audit.service'
import { SessionRepository } from '../../sessions/domain/session.repository'
import {
  MembershipRole,
  MembershipWriteOutcome,
  TenantMember,
} from '../domain/membership.entity'
import { MembershipRepository } from '../domain/membership.repository'

/**
 * Read and administration of who belongs to a household.
 *
 * Membership was until recently a purely internal aggregate: the guards
 * consumed it to answer "may this request proceed", and its only writer was
 * onboarding, which grants the creator the `owner` role. This service is the
 * user-facing surface over it.
 */
@Injectable()
export class MembershipService {
  private readonly logger = new Logger(MembershipService.name)

  constructor(
    private readonly membershipRepository: MembershipRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Tenant-scoped by construction: the caller passes the tenant the guards
   * already resolved and verified membership in, so this can never read a
   * household the requester does not belong to.
   */
  async listMembers(tenantId: string): Promise<TenantMember[]> {
    return this.membershipRepository.listMembersByTenantId(tenantId)
  }

  async changeRole(params: {
    tenantId: string
    userId: string
    role: MembershipRole
    actorUserId: string
    correlationId: string
  }): Promise<void> {
    const outcome = await this.membershipRepository.updateRole({
      tenantId: params.tenantId,
      userId: params.userId,
      role: params.role,
    })

    this.assertWritten(outcome, {
      notFound: 'That person is not a member of this household',
      orphan: 'This household would be left without an owner',
    })

    await this.auditService.record({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      action: 'membership.role_changed',
      resourceType: 'membership',
      resourceId: params.userId,
      correlationId: params.correlationId,
      metadata: { userId: params.userId, role: params.role },
    })
  }

  async removeMember(params: {
    tenantId: string
    userId: string
    actorUserId: string
    correlationId: string
  }): Promise<void> {
    const outcome = await this.membershipRepository.remove({
      tenantId: params.tenantId,
      userId: params.userId,
    })

    this.assertWritten(outcome, {
      notFound: 'That person is not a member of this household',
      orphan: 'This household would be left without an owner',
    })

    // Their live sessions may still be pointed at the household they just left.
    // TenantGuard would reject every request from that point, which reads as a
    // broken dashboard rather than as "you are no longer here", so the pointer
    // is cleared and they land back on the household picker.
    //
    // Best-effort: the removal itself has already happened and is what the
    // caller asked for. Failing the request now would report an error for work
    // that succeeded.
    try {
      await this.sessionRepository.clearActiveTenantForUser(
        params.userId,
        params.tenantId,
      )
    } catch (error) {
      this.logger.error(
        `Removed ${params.userId} from ${params.tenantId} but failed to clear their active tenant: ${error}`,
      )
    }

    await this.auditService.record({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      action: 'membership.removed',
      resourceType: 'membership',
      resourceId: params.userId,
      correlationId: params.correlationId,
      metadata: { userId: params.userId },
    })
  }

  /**
   * Turns the adapter's outcome into the HTTP shape.
   *
   * `would_orphan` is a 409 rather than a 403: the caller is permitted to do
   * this, the household simply cannot be in the state it would produce.
   */
  private assertWritten(
    outcome: MembershipWriteOutcome,
    messages: { notFound: string; orphan: string },
  ): void {
    if (outcome === 'not_found') {
      throw new NotFoundException({
        code: 'MEMBERSHIP_NOT_FOUND',
        message: messages.notFound,
      })
    }

    if (outcome === 'would_orphan') {
      throw new ConflictException({
        code: 'LAST_OWNER',
        message: messages.orphan,
      })
    }
  }
}
