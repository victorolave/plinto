'use client'

import { useQuery } from '@tanstack/react-query'
import { listMembers, type MemberRole, type TenantMember } from '../services/members'
import { queryKeys } from '../../../lib/api/query-keys'
import { MembersSkeleton } from './members-skeleton'
import { Card, CardHeader } from '../../../components/ui/card'
import { Badge } from '../../../components/ui/badge'
import { Avatar } from '../../../components/ui/avatar'
import { EmptyState } from '../../../components/ui/empty-state'
import { Users } from '../../../components/ui/icons'
import { useDashboard } from '../../../components/layout/dashboard-context'

/**
 * Role tone carries meaning, not decoration: the owner is the only role that
 * can administer the household, so it is the only one that reads as brand.
 * A viewer is visually quieter because it holds the least authority.
 */
const ROLE_TONE: Record<MemberRole, 'brand' | 'info' | 'neutral'> = {
  owner: 'brand',
  member: 'info',
  viewer: 'neutral',
}

const ROLE_HINT: Record<MemberRole, string> = {
  owner: 'Manages the household and its members',
  member: 'Can record and edit money movements',
  viewer: 'Can see everything, change nothing',
}

function formatJoinedAt(joinedAt: string): string {
  const date = new Date(joinedAt)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/** Falls back to the local part of the email when the IdP gave us no name. */
function displayNameOf(member: TenantMember): string {
  const name = member.name?.trim()
  if (name) return name
  return member.email.split('@')[0]
}

export function MembersPanel() {
  const { user } = useDashboard()

  const {
    data: members = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.members,
    queryFn: async () => (await listMembers()).data.members,
  })

  const errorMessage = error instanceof Error ? error.message : null

  return (
    <div className="page">
      {errorMessage ? <p className="error-text">{errorMessage}</p> : null}

      <Card flush>
        <CardHeader
          title="Household members"
          subtitle={
            isLoading
              ? 'Loading…'
              : `${members.length} ${members.length === 1 ? 'person' : 'people'} in this household`
          }
        />

        {isLoading ? <MembersSkeleton /> : null}

        {!isLoading && members.length === 0 ? (
          <EmptyState
            icon={<Users size={30} />}
            title="No members yet"
            description="This household has no members, which should not be possible — whoever created it is its owner. Try reloading."
          />
        ) : null}

        {!isLoading && members.length > 0 ? (
          // A real list, not a stack of divs: this is an enumeration of people,
          // so a screen reader should announce it as one and report its length.
          <ul className="member-list" aria-label="Household members">
            {members.map((member) => {
              const name = displayNameOf(member)
              // Email is the identity the API and the IdP agree on, so it is
              // what marks the current user rather than a display name that
              // two people in one household could share.
              const isCurrentUser =
                user.email !== undefined &&
                user.email.toLowerCase() === member.email.toLowerCase()

              return (
                <li key={member.userId} className="data-row">
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-3)',
                      minWidth: 0,
                      flex: 1,
                    }}
                  >
                    <Avatar name={name} />
                    <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span className="account-name">
                        {name}
                        {isCurrentUser ? <span className="muted"> · you</span> : null}
                      </span>
                      <span className="muted" style={{ fontSize: 12 }}>
                        {member.email}
                        {formatJoinedAt(member.joinedAt)
                          ? ` · joined ${formatJoinedAt(member.joinedAt)}`
                          : ''}
                      </span>
                    </span>
                  </div>
                  <Badge tone={ROLE_TONE[member.role]}>{member.role}</Badge>
                </li>
              )
            })}
          </ul>
        ) : null}
      </Card>

      {!isLoading && members.length > 0 ? (
        <Card>
          <CardHeader
            title="What each role can do"
            subtitle="Roles are enforced by the API, not just hidden in the interface"
          />
          <dl className="role-legend">
            {(Object.keys(ROLE_HINT) as MemberRole[]).map((role) => (
              <div key={role} className="role-legend-row">
                <dt>
                  <Badge tone={ROLE_TONE[role]}>{role}</Badge>
                </dt>
                <dd className="muted">{ROLE_HINT[role]}</dd>
              </div>
            ))}
          </dl>
        </Card>
      ) : null}
    </div>
  )
}
