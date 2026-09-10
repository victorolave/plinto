import { describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/render-with-providers'
import { MembersPanel } from '../members-panel'
import type { TenantMember } from '../../services/members'

vi.mock('../../services/members')

// The panel reads the signed-in identity from the dashboard context to mark
// which row is "you". Mocked so the test controls that identity directly.
vi.mock('../../../../components/layout/dashboard-context', () => ({
  useDashboard: () => ({ user: { name: 'Victor', email: 'victor@example.com' } }),
}))

import { listMembers } from '../../services/members'

const mockedListMembers = vi.mocked(listMembers)

function buildMember(overrides: Partial<TenantMember> = {}): TenantMember {
  return {
    userId: 'user-1',
    email: 'victor@example.com',
    name: 'Victor Olave',
    role: 'owner',
    joinedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('MembersPanel', () => {
  it('shows a loading state before members resolve', () => {
    mockedListMembers.mockReturnValue(new Promise(() => {}))

    renderWithProviders(<MembersPanel />)

    expect(screen.getByRole('status', { name: /loading members/i })).toBeInTheDocument()
  })

  it('renders every member with their role', async () => {
    mockedListMembers.mockResolvedValue({
      data: {
        members: [
          buildMember(),
          buildMember({
            userId: 'user-2',
            email: 'sandra@example.com',
            name: 'Sandra Olave',
            role: 'member',
          }),
        ],
      },
    })

    renderWithProviders(<MembersPanel />)

    expect(await screen.findByText('Sandra Olave')).toBeInTheDocument()
    expect(screen.getByText('sandra@example.com', { exact: false })).toBeInTheDocument()

    // Scoped to the list: the role legend below repeats every role name, so an
    // unscoped query would pass even if the roles never rendered.
    const list = within(screen.getByRole('list', { name: /household members/i }))
    expect(list.getAllByRole('listitem')).toHaveLength(2)

    // The role reads as a badge for everybody — owner and viewer see the same
    // roster, and only the actions menu beside it appears or does not.
    expect(list.getByText('owner')).toBeInTheDocument()
    expect(list.getByText('member')).toBeInTheDocument()
  })

  it('marks the signed-in user, and only them', async () => {
    mockedListMembers.mockResolvedValue({
      data: {
        members: [
          buildMember({ email: 'victor@example.com' }),
          buildMember({ userId: 'user-2', email: 'sandra@example.com', name: 'Sandra' }),
        ],
      },
    })

    renderWithProviders(<MembersPanel />)

    expect(await screen.findAllByText(/· you/)).toHaveLength(1)
  })

  // The IdP and the API may disagree on casing; the same person must still be
  // recognised as themselves.
  it('matches the signed-in user case-insensitively', async () => {
    mockedListMembers.mockResolvedValue({
      data: { members: [buildMember({ email: 'VICTOR@EXAMPLE.COM' })] },
    })

    renderWithProviders(<MembersPanel />)

    expect(await screen.findAllByText(/· you/)).toHaveLength(1)
  })

  it('falls back to the email local part when the IdP supplied no name', async () => {
    mockedListMembers.mockResolvedValue({
      data: {
        members: [buildMember({ userId: 'user-3', email: 'sandra@example.com', name: null })],
      },
    })

    renderWithProviders(<MembersPanel />)

    expect(await screen.findByText('sandra')).toBeInTheDocument()
  })

  it('surfaces a load failure instead of rendering an empty household', async () => {
    mockedListMembers.mockRejectedValue(new Error('Network unreachable'))

    renderWithProviders(<MembersPanel />)

    expect(await screen.findByText('Network unreachable')).toBeInTheDocument()
  })

  it('explains each role once members are listed', async () => {
    mockedListMembers.mockResolvedValue({ data: { members: [buildMember()] } })

    renderWithProviders(<MembersPanel />)

    expect(await screen.findByText(/Manages the household and its members/)).toBeInTheDocument()
    expect(screen.getByText(/Can see everything, change nothing/)).toBeInTheDocument()
  })
})
