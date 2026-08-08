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

/** Opens a member's kebab menu, the way the rest of this app offers row actions. */
async function openMenu(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await screen.findByRole('button', { name: new RegExp(`actions for ${name}`, 'i') }))
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedListInvitations.mockResolvedValue({ data: { invitations: [] } })
  mockedChangeRole.mockResolvedValue({ data: { updated: true } })
  mockedRemove.mockResolvedValue({ data: { deleted: true } })
})

describe('MembersPanel — administration', () => {
  it('changes a role from the row menu', async () => {
    const user = userEvent.setup()
    mockedListMembers.mockResolvedValue({ data: { members: [owner(), sandra()] } })

    renderWithProviders(<MembersPanel />)

    await openMenu(user, 'Sandra')
    await user.click(screen.getByRole('menuitem', { name: /make viewer/i }))

    await waitFor(() => expect(mockedChangeRole).toHaveBeenCalledWith('user-2', 'viewer'))
  })

  /** The role somebody already holds is not offered as a change. */
  it('offers only the roles they are not already', async () => {
    const user = userEvent.setup()
    mockedListMembers.mockResolvedValue({ data: { members: [owner(), sandra()] } })

    renderWithProviders(<MembersPanel />)

    await openMenu(user, 'Sandra')
    const menu = within(screen.getByRole('menu'))
    expect(menu.getByRole('menuitem', { name: /make owner/i })).toBeInTheDocument()
    expect(menu.getByRole('menuitem', { name: /make viewer/i })).toBeInTheDocument()
    expect(menu.queryByRole('menuitem', { name: /make member/i })).not.toBeInTheDocument()
  })

  /**
   * The invariant this slice protects. A household with no owner cannot be
   * administered by anybody — including the person who emptied it — and there
   * is no way back short of database access.
   *
   * Not offered at all, rather than offered-and-disabled: the API refuses it
   * with 409 regardless, and a disabled control whose only explanation is a
   * hover tooltip says nothing on a phone.
   */
  it('offers the sole owner no way to demote or remove themselves', async () => {
    const user = userEvent.setup()
    mockedListMembers.mockResolvedValue({ data: { members: [owner(), sandra()] } })

    renderWithProviders(<MembersPanel />)

    await screen.findByText('Victor')
    expect(
      screen.queryByRole('button', { name: /actions for victor/i }),
    ).not.toBeInTheDocument()
  })

  it('says why, in text rather than in a tooltip', async () => {
    mockedListMembers.mockResolvedValue({ data: { members: [owner(), sandra()] } })

    renderWithProviders(<MembersPanel />)

    expect(await screen.findByText(/sole owner/i)).toBeInTheDocument()
  })

  // With a second owner the household survives either change, so both open up.
  it('opens both up once a second owner exists', async () => {
    const user = userEvent.setup()
    mockedListMembers.mockResolvedValue({
      data: { members: [owner(), sandra({ role: 'owner' })] },
    })

    renderWithProviders(<MembersPanel />)

    await openMenu(user, 'Victor')
    const menu = within(screen.getByRole('menu'))
    expect(menu.getByRole('menuitem', { name: /make member/i })).toBeInTheDocument()
    expect(menu.getByRole('menuitem', { name: /leave household/i })).toBeInTheDocument()
  })

  /**
   * Leaving takes effect on the person reading the dialog, so it does not
   * borrow the words used for removing somebody else.
   */
  it('calls it leaving when it is yourself', async () => {
    const user = userEvent.setup()
    mockedListMembers.mockResolvedValue({
      data: { members: [owner(), sandra({ role: 'owner' })] },
    })

    renderWithProviders(<MembersPanel />)

    await openMenu(user, 'Victor')
    await user.click(screen.getByRole('menuitem', { name: /leave household/i }))

    expect(screen.getByText(/leave this household\?/i)).toBeInTheDocument()
    expect(screen.getByText(/you lose access to this household/i)).toBeInTheDocument()
  })

  it('confirms before removing, and only removes on confirmation', async () => {
    const user = userEvent.setup()
    mockedListMembers.mockResolvedValue({ data: { members: [owner(), sandra()] } })

    renderWithProviders(<MembersPanel />)

    await openMenu(user, 'Sandra')
    await user.click(screen.getByRole('menuitem', { name: /remove from household/i }))
    expect(mockedRemove).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /^remove member$/i }))

    await waitFor(() => expect(mockedRemove).toHaveBeenCalledWith('user-2'))
  })

  /**
   * Removing somebody is not removing their work. Saying so is what stops an
   * owner hesitating over whether it deletes the household's history.
   */
  it('says that what they recorded stays', async () => {
    const user = userEvent.setup()
    mockedListMembers.mockResolvedValue({ data: { members: [owner(), sandra()] } })

    renderWithProviders(<MembersPanel />)

    await openMenu(user, 'Sandra')
    await user.click(screen.getByRole('menuitem', { name: /remove from household/i }))

    expect(screen.getByText(/everything they recorded stays/i)).toBeInTheDocument()
  })

  it('surfaces the API refusing a change instead of failing silently', async () => {
    const user = userEvent.setup()
    mockedListMembers.mockResolvedValue({ data: { members: [owner(), sandra()] } })
    mockedChangeRole.mockRejectedValue(
      new Error('This household would be left without an owner'),
    )

    renderWithProviders(<MembersPanel />)

    await openMenu(user, 'Sandra')
    await user.click(screen.getByRole('menuitem', { name: /make viewer/i }))

    expect(await screen.findByText(/without an owner/i)).toBeInTheDocument()
  })

  /**
   * A non-owner sees the roster and nothing else. The API enforces this; the
   * panel only avoids offering controls that would come back 403.
   */
  it.each(['member', 'viewer'] as const)('shows a %s no row actions at all', async (role) => {
    mockedListMembers.mockResolvedValue({
      data: {
        members: [
          owner({ userId: 'user-9', email: 'other@example.com', name: 'Other' }),
          sandra({ email: 'victor@example.com', role }),
        ],
      },
    })

    renderWithProviders(<MembersPanel />)

    await screen.findByText('Other')
    expect(screen.queryByRole('button', { name: /actions for/i })).not.toBeInTheDocument()

    // The roles are still visible — as badges, the same way an owner sees them.
    const roster = within(screen.getByRole('list', { name: /household members/i }))
    expect(roster.getByText('owner')).toBeInTheDocument()
  })
})
