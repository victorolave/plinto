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
