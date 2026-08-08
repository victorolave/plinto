import { z } from 'zod'

/**
 * The three roles a household admits, in descending authority. Extracted from
 * `MembershipSchema` so the members endpoints and the web role selector spend
 * the same definition rather than restating the literals — the permission
 * matrix in the API keys off exactly these values.
 */
export const MembershipRoleSchema = z.enum(['owner', 'member', 'viewer'])

export const MembershipSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  userId: z.string(),
  role: MembershipRoleSchema,
  createdAt: z.string(),
})

/**
 * A member as the household sees them: who they are, not which row joins them.
 *
 * Deliberately not `MembershipSchema` plus a user object. The membership id is
 * an internal join key with no meaning to a person reading a member list, and
 * exposing it invites clients to address members by it. `userId` is the stable
 * identifier every member-facing operation already uses.
 */
export const TenantMemberSchema = z.object({
  userId: z.string(),
  email: z.string().email(),
  /** Null until the identity provider supplies one on login. */
  name: z.string().nullable(),
  role: MembershipRoleSchema,
  joinedAt: z.string(),
})

/**
 * Changing what somebody may do in a household. Only the role is mutable: who
 * they are comes from the identity provider, and when they joined is history.
 */
export const UpdateMemberRoleSchema = z.object({
  role: MembershipRoleSchema,
})

export type UpdateMemberRoleDto = z.infer<typeof UpdateMemberRoleSchema>
export type MembershipRoleDto = z.infer<typeof MembershipRoleSchema>
export type MembershipDto = z.infer<typeof MembershipSchema>
export type TenantMemberDto = z.infer<typeof TenantMemberSchema>
