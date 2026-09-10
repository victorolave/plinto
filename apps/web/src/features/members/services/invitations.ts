import { apiFetch } from '../../../lib/api/client'
import type { MemberRole, TenantMember } from './members'

export interface Invitation {
  id: string
  tenantId: string
  email: string
  role: MemberRole
  invitedByUserId: string
  expiresAt: string
  createdAt: string
}

/**
 * `accepted` when the address already belonged to a Plinto account — that
 * person is a member as of now. `pending` when it did not, and their first
 * login will claim it.
 */
export interface InvitationResult {
  status: 'pending' | 'accepted'
  invitation: Invitation | null
  member: TenantMember | null
}

export async function listInvitations(): Promise<{ data: { invitations: Invitation[] } }> {
  return apiFetch<{ data: { invitations: Invitation[] } }>('/members/invitations')
}

export async function createInvitation(input: {
  email: string
  role: MemberRole
}): Promise<{ data: InvitationResult }> {
  return apiFetch<{ data: InvitationResult }>('/members/invitations', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function revokeInvitation(id: string): Promise<{ data: { deleted: boolean } }> {
  return apiFetch<{ data: { deleted: boolean } }>(
    `/members/invitations/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  )
}
