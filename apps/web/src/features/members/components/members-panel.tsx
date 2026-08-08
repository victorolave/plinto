'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listMembers, type MemberRole, type TenantMember } from '../services/members'
import {
  listInvitations,
  revokeInvitation,
  type Invitation,
  type InvitationResult,
} from '../services/invitations'
import { queryKeys } from '../../../lib/api/query-keys'
import { MembersSkeleton } from './members-skeleton'
import { InviteForm } from './invite-form'
import { Card, CardHeader } from '../../../components/ui/card'
import { Badge } from '../../../components/ui/badge'
import { Avatar } from '../../../components/ui/avatar'
import { Button } from '../../../components/ui/button'
import { Drawer } from '../../../components/ui/drawer'
import { Modal } from '../../../components/ui/modal'
import { EmptyState } from '../../../components/ui/empty-state'
import { Plus, Trash, Users } from '../../../components/ui/icons'
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

function formatExpiry(expiresAt: string): string {
  const date = new Date(expiresAt)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function MembersPanel() {
  const { user } = useDashboard()
  const queryClient = useQueryClient()

  const [inviteOpen, setInviteOpen] = useState(false)
  const [pendingRevoke, setPendingRevoke] = useState<Invitation | null>(null)
  const [lastResult, setLastResult] = useState<InvitationResult | null>(null)

  const {
    data: members = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.members,
    queryFn: async () => (await listMembers()).data.members,
  })

  // The signed-in person's own role decides whether any of this is theirs to
  // do. The API enforces it regardless — this only avoids offering a button
  // that would come back 403.
  const isOwner = members.some(
    (member) =>
      user.email !== undefined &&
      user.email.toLowerCase() === member.email.toLowerCase() &&
      member.role === 'owner',
  )

  const { data: invitations = [] } = useQuery({
    queryKey: queryKeys.invitations,
    queryFn: async () => (await listInvitations()).data.invitations,
    enabled: isOwner,
  })

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeInvitation(id),
    onSuccess: () => {
      setPendingRevoke(null)
      void queryClient.invalidateQueries({ queryKey: queryKeys.invitations })
    },
  })

  const errorMessage =
    error instanceof Error
      ? error.message
      : revokeMutation.error instanceof Error
        ? revokeMutation.error.message
        : null

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
          action={
            isOwner ? (
              <Button
                leftIcon={<Plus size={18} />}
                onClick={() => {
                  setLastResult(null)
                  setInviteOpen(true)
                }}
              >
                Invite
              </Button>
            ) : null
          }
        />

        {lastResult ? (
          <p className="muted" style={{ padding: '0 var(--space-4) var(--space-2)' }}>
            {lastResult.status === 'accepted'
              ? `${lastResult.member?.email ?? 'They'} already had an account and joined right away.`
              : `Invitation sent to ${lastResult.invitation?.email ?? 'them'}. It will be applied the first time they sign in.`}
          </p>
        ) : null}

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

      {isOwner && invitations.length > 0 ? (
        <Card flush>
          <CardHeader
            title="Pending invitations"
            subtitle="Applied the first time each person signs in"
          />
          <ul className="member-list" aria-label="Pending invitations">
            {invitations.map((invitation) => (
              <li key={invitation.id} className="data-row">
                <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span className="account-name">{invitation.email}</span>
                  <span className="muted" style={{ fontSize: 12 }}>
                    Invited as {invitation.role}
                    {formatExpiry(invitation.expiresAt)
                      ? ` · expires ${formatExpiry(invitation.expiresAt)}`
                      : ''}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Trash size={15} />}
                  aria-label={`Revoke invitation for ${invitation.email}`}
                  onClick={() => setPendingRevoke(invitation)}
                >
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

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

      <Drawer
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite someone"
        description="They join this household with the role you pick"
      >
        <InviteForm
          onInvited={(result) => {
            setLastResult(result)
            setInviteOpen(false)
          }}
        />
      </Drawer>

      <Modal
        open={pendingRevoke !== null}
        onClose={() => setPendingRevoke(null)}
        title="Revoke invitation?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingRevoke(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={revokeMutation.isPending}
              onClick={() => pendingRevoke && revokeMutation.mutate(pendingRevoke.id)}
            >
              {revokeMutation.isPending ? 'Revoking…' : 'Revoke invitation'}
            </Button>
          </>
        }
      >
        <p className="muted">
          <strong style={{ color: 'var(--text-strong)' }}>{pendingRevoke?.email}</strong>{' '}
          will no longer join this household when they sign in. You can invite
          them again later.
        </p>
      </Modal>
    </div>
  )
}
