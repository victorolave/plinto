import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { AuditService } from '../../audit/application/audit.service'
import { MembershipRepository } from '../../memberships/domain/membership.repository'
import { MembershipRole, TenantMember } from '../../memberships/domain/membership.entity'
import { UserRepository } from '../../users/domain/user.repository'
import { User } from '../../users/domain/user.entity'
import { Invitation, invitationExpiryFrom, isExpired } from '../domain/invitation.entity'
import { InvitationRepository } from '../domain/invitation.repository'

export type InvitationResult =
  | { status: 'accepted'; invitation: null; member: TenantMember }
  | { status: 'pending'; invitation: Invitation; member: null }

/**
 * Getting a second person into a household.
 *
 * The awkward fact this service exists to absorb: a person has no row in this
 * system until the identity provider hands us their first login (see
 * UserProvisioningService). An owner inviting their partner therefore cannot
 * create a membership — there is nobody to be a member yet. So the offer is
 * recorded against an email address and turned into a membership the moment a
 * user with that address appears.
 *
 * "The moment a user appears" has two triggers, and both call `claimFor`:
 * inviting somebody who already has an account, and logging in. One trigger
 * would not do — an invitation extended to somebody already signed in would sit
 * unclaimed until they happened to log out, and an invitation extended before
 * they ever signed up would never be seen at all.
 */
@Injectable()
export class InvitationService {
  constructor(
    private readonly invitationRepository: InvitationRepository,
    private readonly membershipRepository: MembershipRepository,
    private readonly userRepository: UserRepository,
    private readonly auditService: AuditService,
  ) {}

  async invite(params: {
    tenantId: string
    email: string
    role: MembershipRole
    invitedByUserId: string
    correlationId: string
    now?: Date
  }): Promise<InvitationResult> {
    const now = params.now ?? new Date()
    const email = params.email.trim().toLowerCase()

    if (!email) {
      throw new BadRequestException({
        code: 'INVITATION_EMAIL_REQUIRED',
        message: 'An email address is required to invite someone',
      })
    }

    const existingUser = await this.userRepository.findByEmail(email)

    if (existingUser) {
      // Checked before the invitation is written, so re-inviting an existing
      // member is a clean 409 rather than a row that can never be claimed.
      const membership = await this.membershipRepository.findByUserAndTenant(
        existingUser.id,
        params.tenantId,
      )
      if (membership) {
        throw new ConflictException({
          code: 'ALREADY_A_MEMBER',
          message: 'That person is already a member of this household',
        })
      }
    }

    const invitation = await this.invitationRepository.upsert({
      tenantId: params.tenantId,
      email,
      role: params.role,
      invitedByUserId: params.invitedByUserId,
      expiresAt: invitationExpiryFrom(now),
    })

    await this.auditService.record({
      tenantId: params.tenantId,
      actorUserId: params.invitedByUserId,
      action: 'membership.invited',
      resourceType: 'invitation',
      resourceId: invitation.id,
      correlationId: params.correlationId,
      metadata: { email, role: params.role },
    })

    // Nothing to wait for when the person already has an account: admit them
    // now rather than making them log out and back in to notice.
    if (existingUser) {
      const claimed = await this.claimOne(invitation, existingUser, {
        correlationId: params.correlationId,
        now,
      })
      if (claimed) {
        return { status: 'accepted', invitation: null, member: claimed }
      }
    }

    return { status: 'pending', invitation, member: null }
  }

  async listPending(tenantId: string): Promise<Invitation[]> {
    return this.invitationRepository.listByTenantId(tenantId)
  }

  async revoke(params: {
    invitationId: string
    tenantId: string
    actorUserId: string
    correlationId: string
  }): Promise<void> {
    const deleted = await this.invitationRepository.deleteByIdForTenant(
      params.invitationId,
      params.tenantId,
    )

    if (!deleted) {
      throw new NotFoundException({
        code: 'INVITATION_NOT_FOUND',
        message: 'Invitation not found for the active tenant',
      })
    }

    await this.auditService.record({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      action: 'membership.invitation_revoked',
      resourceType: 'invitation',
      resourceId: params.invitationId,
      correlationId: params.correlationId,
    })
  }

  /**
   * Turns every invitation addressed to this user into a membership.
   *
   * Called on login, so it must never be able to break one: a household that
   * cannot be joined is a worse outcome than a session that fails to open.
   * Every branch that could throw is therefore a `continue` — an expired offer,
   * a membership that already exists, a household that vanished.
   */
  async claimFor(
    user: User,
    options: { correlationId: string; now?: Date },
  ): Promise<TenantMember[]> {
    const now = options.now ?? new Date()
    const invitations = await this.invitationRepository.listByEmail(user.email)
    const claimed: TenantMember[] = []

    for (const invitation of invitations) {
      const member = await this.claimOne(invitation, user, {
        correlationId: options.correlationId,
        now,
      })
      if (member) {
        claimed.push(member)
      }
    }

    return claimed
  }

  /**
   * Returns the membership an invitation produced, or null when it produced
   * none — expired, or already satisfied. The invitation row is consumed in
   * both cases: an offer that cannot be accepted should not linger as one.
   */
  private async claimOne(
    invitation: Invitation,
    user: User,
    options: { correlationId: string; now: Date },
  ): Promise<TenantMember | null> {
    if (isExpired(invitation, options.now)) {
      await this.invitationRepository.deleteById(invitation.id)
      return null
    }

    const existing = await this.membershipRepository.findByUserAndTenant(
      user.id,
      invitation.tenantId,
    )
    if (existing) {
      await this.invitationRepository.deleteById(invitation.id)
      return null
    }

    const membership = await this.membershipRepository.create({
      tenantId: invitation.tenantId,
      userId: user.id,
      role: invitation.role,
    })

    // Deleted after the membership exists, never before. If this process dies
    // between the two, the invitation is still standing and the next claim is a
    // no-op that cleans it up — whereas the other order would drop the offer
    // and leave the person outside with nothing to retry.
    await this.invitationRepository.deleteById(invitation.id)

    await this.auditService.record({
      tenantId: invitation.tenantId,
      actorUserId: user.id,
      action: 'membership.invitation_accepted',
      resourceType: 'membership',
      resourceId: membership.id,
      correlationId: options.correlationId,
      metadata: {
        invitationId: invitation.id,
        email: invitation.email,
        role: invitation.role,
        invitedByUserId: invitation.invitedByUserId,
      },
    })

    return {
      userId: user.id,
      email: user.email,
      name: user.name ?? null,
      role: membership.role,
      joinedAt: membership.createdAt,
    }
  }
}
