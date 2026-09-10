export type MembershipRole = 'owner' | 'member' | 'viewer'

export type Membership = {
  id: string
  tenantId: string
  userId: string
  role: MembershipRole
  createdAt: Date
  updatedAt: Date
}

/**
 * A membership joined with the identity behind it — what a member list has to
 * show. Kept separate from `Membership` because the join is a read concern:
 * every write path in this aggregate operates on `Membership` alone, and
 * widening that type would drag user fields into places that must not set them.
 */
export type TenantMember = {
  userId: string
  email: string
  name: string | null
  role: MembershipRole
  joinedAt: Date
}

/**
 * What a guarded membership write did, as data rather than as an exception.
 *
 * `would_orphan` is the one that matters: a household with no owner cannot be
 * administered by anybody, including the person who emptied it. The check and
 * the write have to happen together to be worth anything, so the outcome is
 * decided where that atomicity exists — in the adapter — and the meaning is
 * carried back here for the service to translate.
 */
export type MembershipWriteOutcome = 'ok' | 'not_found' | 'would_orphan'
