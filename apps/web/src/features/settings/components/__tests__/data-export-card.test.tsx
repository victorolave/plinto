import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/render-with-providers'
import { DataExportCard } from '../data-export-card'
import type { TenantMember } from '../../../members/services/members'

vi.mock('../../../members/services/members')
vi.mock('../../services/export')

vi.mock('../../../../components/layout/dashboard-context', () => ({
  useDashboard: () => ({ user: { name: 'Victor', email: 'victor@example.com' } }),
}))

import { listMembers } from '../../../members/services/members'
import { downloadHouseholdExport, downloadTransactionsCsv } from '../../services/export'

const mockedListMembers = vi.mocked(listMembers)
const mockedDownloadHouseholdExport = vi.mocked(downloadHouseholdExport)
const mockedDownloadTransactionsCsv = vi.mocked(downloadTransactionsCsv)

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

describe('DataExportCard', () => {
  it('renders nothing while members are still loading', () => {
    mockedListMembers.mockReturnValue(new Promise(() => {}))

    const { container } = renderWithProviders(<DataExportCard />)

    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing for a non-owner', async () => {
    mockedListMembers.mockResolvedValue({
      data: { members: [buildMember({ role: 'member' })] },
    })

    const { container } = renderWithProviders(<DataExportCard />)

    await waitFor(() => expect(mockedListMembers).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('shows both download buttons for the owner', async () => {
    mockedListMembers.mockResolvedValue({ data: { members: [buildMember()] } })

    renderWithProviders(<DataExportCard />)

    expect(await screen.findByRole('button', { name: /household \(json\)/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /transactions \(csv\)/i })).toBeInTheDocument()
  })

  it('calls the JSON export service when the JSON button is clicked', async () => {
    mockedListMembers.mockResolvedValue({ data: { members: [buildMember()] } })
    mockedDownloadHouseholdExport.mockResolvedValue(undefined)
    const user = userEvent.setup()

    renderWithProviders(<DataExportCard />)

    const button = await screen.findByRole('button', { name: /household \(json\)/i })
    await user.click(button)

    await waitFor(() => expect(mockedDownloadHouseholdExport).toHaveBeenCalledTimes(1))
  })

  it('calls the CSV export service when the CSV button is clicked', async () => {
    mockedListMembers.mockResolvedValue({ data: { members: [buildMember()] } })
    mockedDownloadTransactionsCsv.mockResolvedValue(undefined)
    const user = userEvent.setup()

    renderWithProviders(<DataExportCard />)

    const button = await screen.findByRole('button', { name: /transactions \(csv\)/i })
    await user.click(button)

    await waitFor(() => expect(mockedDownloadTransactionsCsv).toHaveBeenCalledTimes(1))
  })

  it('shows an error line when the download fails', async () => {
    mockedListMembers.mockResolvedValue({ data: { members: [buildMember()] } })
    mockedDownloadHouseholdExport.mockRejectedValue(new Error('Network unreachable'))
    const user = userEvent.setup()

    renderWithProviders(<DataExportCard />)

    const button = await screen.findByRole('button', { name: /household \(json\)/i })
    await user.click(button)

    expect(await screen.findByText('Network unreachable')).toBeInTheDocument()
  })
})
