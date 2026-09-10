import { z } from 'zod'
import { MembershipRoleSchema } from './membership.schema'
import { TenantMemberSchema } from './membership.schema'

/**
 * A standing offer to join a household.
 *
 * Addressed to an email rather than to a user id, because a person does not
 * exist in Plinto until the identity provider hands us their first login — the
 * household that wants them cannot reference a row that is not there yet.
 */
export const InvitationSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  email: z.string().email(),
  role: MembershipRoleSchema,
  invitedByUserId: z.string(),
  expiresAt: z.string(),
  createdAt: z.string(),
})

/**
 * The email is normalised in the contract, not in a handler: trimmed and
 * lower-cased before anything downstream sees it. The uniqueness of a pending
 * invitation is per person, and `Sandra@Example.com` and `sandra@example.com`
 * are one person.
 */
export const CreateInvitationSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.string().email()),
  role: MembershipRoleSchema,
})

/**
 * Inviting someone who already has a Plinto account admits them immediately —
 * there is nothing to wait for. Inviting someone who does not leaves an
 * invitation for their first login to claim. The caller is told which happened
 * so the interface can say so rather than guess.
 */
export const InvitationResultSchema = z.object({
  status: z.enum(['pending', 'accepted']),
  invitation: InvitationSchema.nullable(),
  member: TenantMemberSchema.nullable(),
})

export type InvitationDto = z.infer<typeof InvitationSchema>
export type CreateInvitationDto = z.infer<typeof CreateInvitationSchema>
export type InvitationResultDto = z.infer<typeof InvitationResultSchema>
