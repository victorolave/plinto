'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  changeMemberRole,
  listMembers,
  removeMember,
  type MemberRole,
  type TenantMember,
} from '../services/members'
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
import { ActionsMenu, type ActionMenuItem } from '../../../components/ui/actions-menu'
import { LogOut, Plus, Trash, Users, X } from '../../../components/ui/icons'
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

const ROLES: MemberRole[] = ['owner', 'member', 'viewer']

function formatJoinedAt(joinedAt: string): string {
  const date = new Date(joinedAt)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatExpiry(expiresAt: string): string {
  const date = new Date(expiresAt)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** Falls back to the local part of the email when the IdP gave us no name. */
function displayNameOf(member: TenantMember): string {
  const name = member.name?.trim()
  if (name) return name
  return member.email.split('@')[0]
}

export function MembersPanel() {
  const { user } = useDashboard()
  const queryClient = useQueryClient()

  const [inviteOpen, setInviteOpen] = useState(false)
  const [pendingRevoke, setPendingRevoke] = useState<Invitation | null>(null)
  const [pendingRemove, setPendingRemove] = useState<TenantMember | null>(null)
  const [lastResult, setLastResult] = useState<InvitationResult | null>(null)

  const {
    data: members = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.members,
    queryFn: async () => (await listMembers()).data.members,
  })

  // Email is the identity the API and the IdP agree on, so it is what marks the
  // current user rather than a display name two people could share.
  const isSelf = (member: TenantMember) =>
    user.email !== undefined && user.email.toLowerCase() === member.email.toLowerCase()

  const isOwner = members.some((member) => isSelf(member) && member.role === 'owner')

  // Controls appear only once the roster has actually resolved. Deriving them
  // from a list that is still empty would flash an interface saying "you may do
  // nothing here" and then replace it a moment later.
  const canAdminister = !isLoading && isOwner

  const { data: invitations = [] } = useQuery({
    queryKey: queryKeys.invitations,
    queryFn: async () => (await listInvitations()).data.invitations,
    enabled: isOwner,
  })

  // A household with no owner cannot be administered by anybody, so the last one
  // can be neither demoted nor removed. The API refuses it with 409 regardless;
  // the interface does not offer what would be refused, and says why in text
  // rather than in a hover tooltip nobody on a phone can read.
  const ownerCount = members.filter((member) => member.role === 'owner').length
  const isSoleOwner = (member: TenantMember) => member.role === 'owner' && ownerCount <= 1

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: MemberRole }) =>
      changeMemberRole(userId, role),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.members })
    },
  })

  const removeMutation = useMutation({
    mutationFn: (userId: string) => removeMember(userId),
    onSuccess: () => {
      setPendingRemove(null)
      void queryClient.invalidateQueries({ queryKey: queryKeys.members })
    },
  })

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeInvitation(id),
    onSuccess: () => {
      setPendingRevoke(null)
      void queryClient.invalidateQueries({ queryKey: queryKeys.invitations })
    },
  })

  const failure = [
    error,
    roleMutation.error,
    removeMutation.error,
    revokeMutation.error,
  ].find((candidate): candidate is Error => candidate instanceof Error)

  /**
   * Which row is mid-save, so only that one reports it. Keying off `isPending`
   * alone greyed out every member in the list while one of them changed.
   */
  const savingUserId = roleMutation.isPending ? roleMutation.variables?.userId : undefined

  function actionsFor(member: TenantMember): ActionMenuItem[] {
    const actions: ActionMenuItem[] = ROLES.filter((role) => role !== member.role)
      // Demoting the only owner is the one change nobody could undo from inside
      // the app, so it is not offered at all.
      .filter((role) => !(isSoleOwner(member) && role !== 'owner'))
      .map((role) => ({
        label: `Make ${role}`,
        onClick: () => roleMutation.mutate({ userId: member.userId, role }),
      }))

    if (!isSoleOwner(member)) {
      actions.push({
        label: isSelf(member) ? 'Leave household' : 'Remove from household',
        icon: isSelf(member) ? <LogOut size={15} /> : <Trash size={15} />,
        danger: true,
        onClick: () => setPendingRemove(member),
      })
    }

    return actions
  }

  const removingSelf = pendingRemove !== null && isSelf(pendingRemove)

  return (
    <div className="page">
      {failure ? <p className="error-text">{failure.message}</p> : null}

      <Card flush>
        <CardHeader
          title="Household members"
          subtitle={
            isLoading
              ? 'Loading…'
              : `${members.length} ${members.length === 1 ? 'person' : 'people'} in this household`
          }
          action={
            canAdminister ? (
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
          <div className="member-notice">
            <span className="muted">
              {lastResult.status === 'accepted'
                ? `${lastResult.member?.email ?? 'They'} already had an account and joined right away.`
                : `Invitation sent to ${lastResult.invitation?.email ?? 'them'}. It will be applied the first time they sign in.`}
            </span>
            {/* Dismissible, because it reports a moment rather than a state.
                Left alone it would still be announcing "sent" tomorrow. */}
            <Button
              variant="ghost"
              size="sm"
              aria-label="Dismiss"
              onClick={() => setLastResult(null)}
            >
              <X size={14} />
            </Button>
          </div>
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
              const saving = savingUserId === member.userId
              const actions = actionsFor(member)

              return (
                <li key={member.userId} className="data-row">
                  <div className="member-identity">
                    <Avatar name={name} />
                    <span className="member-identity-text">
                      <span className="account-name">
                        {name}
                        {isSelf(member) ? <span className="muted"> · you</span> : null}
                      </span>
                      <span className="muted member-identity-meta">
                        {member.email}
                        {formatJoinedAt(member.joinedAt)
                          ? ` · joined ${formatJoinedAt(member.joinedAt)}`
                          : ''}
                      </span>
                    </span>
                  </div>

                  <span className="member-row-actions">
                    {/* One visual language for everybody: the role always reads
                        as a badge, and only the menu beside it appears or does
                        not. An owner and a viewer see the same roster. */}
                    <Badge tone={ROLE_TONE[member.role]}>{member.role}</Badge>

                    {saving ? (
                      <span className="muted member-row-status">Saving…</span>
                    ) : null}

                    {canAdminister && isSoleOwner(member) ? (
                      <span className="muted member-row-status">Sole owner</span>
                    ) : null}

                    {canAdminister && !saving && actions.length > 0 ? (
                      <ActionsMenu label={`Actions for ${name}`} items={actions} />
                    ) : null}
                  </span>
                </li>
              )
            })}
          </ul>
        ) : null}
      </Card>

      {canAdminister && invitations.length > 0 ? (
        <Card flush>
          <CardHeader
            title="Pending invitations"
            subtitle="Applied the first time each person signs in"
          />
          <ul className="member-list" aria-label="Pending invitations">
            {invitations.map((invitation) => (
              <li key={invitation.id} className="data-row">
                <span className="member-identity-text">
                  <span className="account-name">{invitation.email}</span>
                  <span className="muted member-identity-meta">
                    Invited as {invitation.role}
                    {formatExpiry(invitation.expiresAt)
                      ? ` · expires ${formatExpiry(invitation.expiresAt)}`
                      : ''}
                  </span>
                </span>
                <ActionsMenu
                  label={`Actions for ${invitation.email}`}
                  items={[
                    {
                      label: 'Revoke invitation',
                      icon: <Trash size={15} />,
                      danger: true,
                      onClick: () => setPendingRevoke(invitation),
                    },
                  ]}
                />
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
            {ROLES.map((role) => (
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
        open={pendingRemove !== null}
        onClose={() => setPendingRemove(null)}
        title={removingSelf ? 'Leave this household?' : 'Remove from household?'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingRemove(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={removeMutation.isPending}
              onClick={() => pendingRemove && removeMutation.mutate(pendingRemove.userId)}
            >
              {removeMutation.isPending
                ? removingSelf
                  ? 'Leaving…'
                  : 'Removing…'
                : removingSelf
                  ? 'Leave household'
                  : 'Remove member'}
            </Button>
          </>
        }
      >
        {/* Leaving is not the same act as removing somebody else — it takes
            effect on the person reading the dialog — so it does not borrow the
            same words. */}
        <p className="muted">
          {removingSelf ? (
            <>
              You lose access to this household straight away. Everything you
              recorded stays — money movements belong to the household, not to
              the person who typed them. An owner can invite you back.
            </>
          ) : (
            <>
              <strong style={{ color: 'var(--text-strong)' }}>
                {pendingRemove ? displayNameOf(pendingRemove) : ''}
              </strong>{' '}
              loses access to this household. Everything they recorded stays —
              money movements belong to the household, not to the person who
              typed them. You can invite them back later.
            </>
          )}
        </p>
      </Modal>

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
