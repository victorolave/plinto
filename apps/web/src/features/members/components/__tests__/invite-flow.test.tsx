import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/render-with-providers'
import { MembersPanel } from '../members-panel'
import type { TenantMember } from '../../services/members'
import type { Invitation } from '../../services/invitations'

vi.mock('../../services/members')
vi.mock('../../services/invitations')
vi.mock('../../../../components/layout/dashboard-context', () => ({
  useDashboard: () => ({ user: { name: 'Victor', email: 'victor@example.com' } }),
}))

import { listMembers } from '../../services/members'
import {
  createInvitation,
  listInvitations,
  revokeInvitation,
} from '../../services/invitations'

const mockedListMembers = vi.mocked(listMembers)
const mockedListInvitations = vi.mocked(listInvitations)
const mockedCreateInvitation = vi.mocked(createInvitation)
const mockedRevokeInvitation = vi.mocked(revokeInvitation)

const member = (overrides: Partial<TenantMember> = {}): TenantMember => ({
  userId: 'user-1',
  email: 'victor@example.com',
  name: 'Victor',
  role: 'owner',
  joinedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

const invitation = (overrides: Partial<Invitation> = {}): Invitation => ({
  id: 'inv-1',
  tenantId: 'tenant-1',
  email: 'sandra@example.com',
  role: 'member',
  invitedByUserId: 'user-1',
  expiresAt: '2026-08-22T00:00:00.000Z',
  createdAt: '2026-08-08T00:00:00.000Z',
  ...overrides,
})

beforeEach(() => {
  // Call history is not cleared between tests by this project's vitest config,
  // and one assertion below is about a call NOT happening — without this it
  // would read a previous test's calls and pass or fail for the wrong reason.
  vi.clearAllMocks()
  mockedListInvitations.mockResolvedValue({ data: { invitations: [] } })
})

describe('MembersPanel — invitations', () => {
  /**
   * The API enforces this regardless; the panel only avoids offering a control
   * that would come back 403. Both directions are pinned because getting the
   * gate backwards is silent in one of them.
   */
  it('offers Invite to an owner', async () => {
    mockedListMembers.mockResolvedValue({ data: { members: [member({ role: 'owner' })] } })

    renderWithProviders(<MembersPanel />)

    expect(await screen.findByRole('button', { name: /invite/i })).toBeInTheDocument()
  })

  it.each(['member', 'viewer'] as const)('hides Invite from a %s', async (role) => {
    mockedListMembers.mockResolvedValue({ data: { members: [member({ role })] } })

    renderWithProviders(<MembersPanel />)

    await screen.findByText('Victor')
    expect(screen.queryByRole('button', { name: /invite/i })).not.toBeInTheDocument()
  })

  it('does not even ask for invitations when the viewer is not an owner', async () => {
    mockedListMembers.mockResolvedValue({ data: { members: [member({ role: 'viewer' })] } })

    renderWithProviders(<MembersPanel />)

    await screen.findByText('Victor')
    expect(mockedListInvitations).not.toHaveBeenCalled()
  })

  it('sends an invitation and reports it is waiting for their first sign-in', async () => {
    const user = userEvent.setup()
    mockedListMembers.mockResolvedValue({ data: { members: [member()] } })
    mockedCreateInvitation.mockResolvedValue({
      data: { status: 'pending', invitation: invitation(), member: null },
    })

    renderWithProviders(<MembersPanel />)

    await user.click(await screen.findByRole('button', { name: /invite/i }))
    await user.type(screen.getByLabelText(/email/i), 'sandra@example.com')
    await user.click(screen.getByRole('button', { name: /send invitation/i }))

    await waitFor(() =>
      expect(mockedCreateInvitation).toHaveBeenCalledWith({
        email: 'sandra@example.com',
        role: 'member',
      }),
    )
    expect(await screen.findByText(/first time they sign in/i)).toBeInTheDocument()
  })

  /**
   * The distinction the API returns exists so the interface can say which
   * happened instead of guessing. Somebody who already had an account is a
   * member now, not a pending invitation.
   */
  it('says so when the invitee already had an account', async () => {
    const user = userEvent.setup()
    mockedListMembers.mockResolvedValue({ data: { members: [member()] } })
    mockedCreateInvitation.mockResolvedValue({
      data: {
        status: 'accepted',
        invitation: null,
        member: member({ userId: 'user-2', email: 'sandra@example.com', role: 'member' }),
      },
    })

    renderWithProviders(<MembersPanel />)

    await user.click(await screen.findByRole('button', { name: /invite/i }))
    await user.type(screen.getByLabelText(/email/i), 'sandra@example.com')
    await user.click(screen.getByRole('button', { name: /send invitation/i }))

    expect(await screen.findByText(/joined right away/i)).toBeInTheDocument()
  })

  it('normalises the address before sending it', async () => {
    const user = userEvent.setup()
    mockedListMembers.mockResolvedValue({ data: { members: [member()] } })
    mockedCreateInvitation.mockResolvedValue({
      data: { status: 'pending', invitation: invitation(), member: null },
    })

    renderWithProviders(<MembersPanel />)

    await user.click(await screen.findByRole('button', { name: /invite/i }))
    await user.type(screen.getByLabelText(/email/i), '  Sandra@Example.COM  ')
    await user.click(screen.getByRole('button', { name: /send invitation/i }))

    await waitFor(() =>
      expect(mockedCreateInvitation).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'sandra@example.com' }),
      ),
    )
  })

  it('surfaces the API refusing a duplicate instead of failing silently', async () => {
    const user = userEvent.setup()
    mockedListMembers.mockResolvedValue({ data: { members: [member()] } })
    mockedCreateInvitation.mockRejectedValue(
      new Error('That person is already a member of this household'),
    )

    renderWithProviders(<MembersPanel />)

    await user.click(await screen.findByRole('button', { name: /invite/i }))
    await user.type(screen.getByLabelText(/email/i), 'victor@example.com')
    await user.click(screen.getByRole('button', { name: /send invitation/i }))

    expect(await screen.findByText(/already a member/i)).toBeInTheDocument()
  })

  it('lists pending invitations separately from members', async () => {
    mockedListMembers.mockResolvedValue({ data: { members: [member()] } })
    mockedListInvitations.mockResolvedValue({
      data: { invitations: [invitation({ email: 'sandra@example.com', role: 'viewer' })] },
    })

    renderWithProviders(<MembersPanel />)

    const pending = within(
      await screen.findByRole('list', { name: /pending invitations/i }),
    )
    expect(pending.getByText('sandra@example.com')).toBeInTheDocument()
    expect(pending.getByText(/invited as viewer/i)).toBeInTheDocument()

    // Not conflated with the roster: a pending invitation is not a member.
    const roster = within(screen.getByRole('list', { name: /household members/i }))
    expect(roster.queryByText('sandra@example.com')).not.toBeInTheDocument()
  })

  it('confirms before revoking, and only revokes on confirmation', async () => {
    const user = userEvent.setup()
    mockedListMembers.mockResolvedValue({ data: { members: [member()] } })
    mockedListInvitations.mockResolvedValue({ data: { invitations: [invitation()] } })
    mockedRevokeInvitation.mockResolvedValue({ data: { deleted: true } })

    renderWithProviders(<MembersPanel />)

    await user.click(await screen.findByRole('button', { name: /revoke invitation for/i }))
    expect(mockedRevokeInvitation).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /^revoke invitation$/i }))

    await waitFor(() => expect(mockedRevokeInvitation).toHaveBeenCalledWith('inv-1'))
  })
})
