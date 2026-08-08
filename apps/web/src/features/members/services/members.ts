import { apiFetch } from '../../../lib/api/client'

export type MemberRole = 'owner' | 'member' | 'viewer'

export interface TenantMember {
  userId: string
  email: string
  /** Null when the identity provider never supplied a display name. */
  name: string | null
  role: MemberRole
  joinedAt: string
}

/**
 * Members of the active household. The tenant is never passed: the API resolves
 * it from the session, the same way every other tenant-scoped call here works.
 */
export async function listMembers(): Promise<{ data: { members: TenantMember[] } }> {
  return apiFetch<{ data: { members: TenantMember[] } }>('/members')
}

export async function changeMemberRole(
  userId: string,
  role: MemberRole,
): Promise<{ data: { updated: boolean } }> {
  return apiFetch<{ data: { updated: boolean } }>(
    `/members/${encodeURIComponent(userId)}`,
    { method: 'PATCH', body: JSON.stringify({ role }) },
  )
}

export async function removeMember(
  userId: string,
): Promise<{ data: { deleted: boolean } }> {
  return apiFetch<{ data: { deleted: boolean } }>(
    `/members/${encodeURIComponent(userId)}`,
    { method: 'DELETE' },
  )
}
