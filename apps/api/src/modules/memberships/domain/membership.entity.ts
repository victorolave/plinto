export type MembershipRole = 'owner' | 'member' | 'viewer'

export type Membership = {
  id: string
  tenantId: string
  userId: string
  role: MembershipRole
  createdAt: Date
  updatedAt: Date
}
