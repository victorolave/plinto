import { MembershipRole } from '../../memberships/domain/membership.entity'

/**
 * A standing offer to join a household, keyed by email because the person it
 * addresses may have no Plinto account yet.
 */
export type Invitation = {
  id: string
  tenantId: string
  /** Always lower-cased; the repository normalises on the way in and out. */
  email: string
  role: MembershipRole
  invitedByUserId: string
  expiresAt: Date
  createdAt: Date
  updatedAt: Date
}

/** How long an unclaimed invitation stands before it stops being honoured. */
export const INVITATION_TTL_DAYS = 14

export function invitationExpiryFrom(now: Date): Date {
  return new Date(now.getTime() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000)
}

/**
 * Expiry is derived from the stored instant rather than swept by a job, for the
 * same reason obligation status is derived from its payments: a row that ages
 * on its own cannot drift out of step with a scheduler that failed to run.
 */
export function isExpired(invitation: Invitation, now: Date): boolean {
  return invitation.expiresAt.getTime() <= now.getTime()
}
