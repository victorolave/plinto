import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../../test/render-with-providers'
import { DashboardShell } from '../dashboard-shell'

vi.mock('../../../lib/api/client')
vi.mock('../../../features/tenants/services/tenant-selection')
vi.mock('../../../features/onboarding/tour/use-product-tour', () => ({
  useProductTourController: () => ({ start: vi.fn(), isRunning: false }),
}))
vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: vi.fn() }),
}))

import { apiFetch } from '../../../lib/api/client'
import { listTenants } from '../../../features/tenants/services/tenant-selection'

const mockedApiFetch = vi.mocked(apiFetch)
const mockedListTenants = vi.mocked(listTenants)

function mockBootstrap(tenants: Array<{ id: string; name: string; isDemo: boolean }>) {
  mockedApiFetch.mockImplementation(async (path: string) => {
    if (path === '/me') {
      return {
        data: {
          activeTenantId: tenants[0]?.id ?? null,
          user: { name: 'Victor', email: 'victor@example.com', onboardingTourSeenAt: '2026-01-01T00:00:00.000Z' },
        },
      } as any
    }
    throw new Error(`Unexpected apiFetch call: ${path}`)
  })
  mockedListTenants.mockResolvedValue({ data: { tenants } })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('DashboardShell', () => {
  it('shows the demo banner when the active household is the example one', async () => {
    mockBootstrap([{ id: 'demo-1', name: 'Hogar de ejemplo', isDemo: true }])

    renderWithProviders(
      <DashboardShell>
        <div>content</div>
      </DashboardShell>,
    )

    expect(await screen.findByText("You're in the example household. This data is invented.")).toBeInTheDocument()
  })

  it('does not show the demo banner for a real household', async () => {
    mockBootstrap([{ id: 'tenant-1', name: 'My household', isDemo: false }])

    renderWithProviders(
      <DashboardShell>
        <div>content</div>
      </DashboardShell>,
    )

    await waitFor(() => expect(screen.getByText('content')).toBeInTheDocument())
    expect(
      screen.queryByText("You're in the example household. This data is invented."),
    ).not.toBeInTheDocument()
  })
})
