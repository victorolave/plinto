import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/render-with-providers'
import { MembersPanel } from '../members-panel'
import type { TenantMember } from '../../services/members'

vi.mock('../../services/members')
vi.mock('../../services/invitations')
vi.mock('../../../../components/layout/dashboard-context', () => ({
  useDashboard: () => ({ user: { name: 'Victor', email: 'victor@example.com' } }),
}))

import { changeMemberRole, listMembers, removeMember } from '../../services/members'
import { listInvitations } from '../../services/invitations'

const mockedListMembers = vi.mocked(listMembers)
const mockedChangeRole = vi.mocked(changeMemberRole)
const mockedRemove = vi.mocked(removeMember)
const mockedListInvitations = vi.mocked(listInvitations)

const owner = (overrides: Partial<TenantMember> = {}): TenantMember => ({
  userId: 'user-1',
  email: 'victor@example.com',
  name: 'Victor',
  role: 'owner',
  joinedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

const sandra = (overrides: Partial<TenantMember> = {}): TenantMember => ({
  userId: 'user-2',
  email: 'sandra@example.com',
  name: 'Sandra',
  role: 'member',
  joinedAt: '2026-02-01T00:00:00.000Z',
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  mockedListInvitations.mockResolvedValue({ data: { invitations: [] } })
  mockedChangeRole.mockResolvedValue({ data: { updated: true } })
  mockedRemove.mockResolvedValue({ data: { deleted: true } })
})

describe('MembersPanel — administration', () => {
  it('changes a role from the row', async () => {
    const user = userEvent.setup()
    mockedListMembers.mockResolvedValue({ data: { members: [owner(), sandra()] } })

    renderWithProviders(<MembersPanel />)

    await user.selectOptions(await screen.findByLabelText(/role for sandra/i), 'viewer')

    await waitFor(() =>
      expect(mockedChangeRole).toHaveBeenCalledWith('user-2', 'viewer'),
    )
  })

  /**
   * The invariant this slice exists to protect. A household with no owner
   * cannot be administered by anybody — including the person who emptied it —
   * and there is no way back short of database access.
   *
   * The API refuses it with 409 regardless. Disabling the control with a reason
   * is better than letting somebody click and read an error.
   */
  it('will not let the only owner demote themselves', async () => {
    mockedListMembers.mockResolvedValue({ data: { members: [owner(), sandra()] } })

    renderWithProviders(<MembersPanel />)

    const select = await screen.findByLabelText(/role for victor/i)
    expect(select).toBeDisabled()
    expect(select).toHaveAttribute('title', expect.stringMatching(/at least one owner/i))
  })

  it('will not let the only owner remove themselves', async () => {
    mockedListMembers.mockResolvedValue({ data: { members: [owner(), sandra()] } })

    renderWithProviders(<MembersPanel />)

    expect(await screen.findByRole('button', { name: /remove victor/i })).toBeDisabled()
  })

  // With a second owner the household survives either change, so both open up.
  it('allows demoting an owner once a second one exists', async () => {
    mockedListMembers.mockResolvedValue({
      data: { members: [owner(), sandra({ role: 'owner' })] },
    })

    renderWithProviders(<MembersPanel />)

    expect(await screen.findByLabelText(/role for victor/i)).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /remove victor/i })).not.toBeDisabled()
  })

  it('confirms before removing, and only removes on confirmation', async () => {
    const user = userEvent.setup()
    mockedListMembers.mockResolvedValue({ data: { members: [owner(), sandra()] } })

    renderWithProviders(<MembersPanel />)

    await user.click(await screen.findByRole('button', { name: /remove sandra/i }))
    expect(mockedRemove).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /^remove member$/i }))

    await waitFor(() => expect(mockedRemove).toHaveBeenCalledWith('user-2'))
  })

  /**
   * Removing somebody is not removing their work. Saying so in the dialog is
   * what stops an owner hesitating over whether it deletes the household's
   * history.
   */
  it('says that what they recorded stays', async () => {
    const user = userEvent.setup()
    mockedListMembers.mockResolvedValue({ data: { members: [owner(), sandra()] } })

    renderWithProviders(<MembersPanel />)

    await user.click(await screen.findByRole('button', { name: /remove sandra/i }))

    expect(screen.getByText(/everything they recorded stays/i)).toBeInTheDocument()
  })

  it('surfaces the API refusing a change instead of failing silently', async () => {
    const user = userEvent.setup()
    mockedListMembers.mockResolvedValue({ data: { members: [owner(), sandra()] } })
    mockedChangeRole.mockRejectedValue(
      new Error('This household would be left without an owner'),
    )

    renderWithProviders(<MembersPanel />)

    await user.selectOptions(await screen.findByLabelText(/role for sandra/i), 'viewer')

    expect(await screen.findByText(/without an owner/i)).toBeInTheDocument()
  })

  /**
   * A non-owner sees the roster and nothing else. The API enforces this; the
   * panel only avoids offering controls that would come back 403.
   */
  it.each(['member', 'viewer'] as const)('shows a %s the roles as plain text', async (role) => {
    mockedListMembers.mockResolvedValue({
      data: { members: [owner({ userId: 'user-9', email: 'other@example.com', name: 'Other' }), sandra({ email: 'victor@example.com', role })] },
    })

    renderWithProviders(<MembersPanel />)

    await screen.findByText('Other')
    expect(screen.queryByLabelText(/role for/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^remove /i })).not.toBeInTheDocument()

    const roster = within(screen.getByRole('list', { name: /household members/i }))
    expect(roster.getByText('owner')).toBeInTheDocument()
  })
})
