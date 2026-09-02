import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/render-with-providers'
import { Sidebar } from '../sidebar'

const start = vi.fn()

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}))

vi.mock('../dashboard-context', () => ({
  useDashboard: () => ({
    tenants: [{ id: 'tenant-1', name: 'Casa' }],
    activeTenantId: 'tenant-1',
    onSelectTenant: vi.fn(),
    user: { name: 'Alice', email: 'alice@example.com' },
    onLogout: vi.fn(),
    loggingOut: false,
  }),
}))

vi.mock('../../../features/onboarding/tour/product-tour-context', () => ({
  useProductTour: () => ({ start, isRunning: false }),
}))

describe('Sidebar', () => {
  it('renders a help button that starts the product tour', async () => {
    renderWithProviders(<Sidebar />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Help' }))

    expect(start).toHaveBeenCalledTimes(1)
  })

  it('tags navigation links and the help button with data-tour anchors', () => {
    renderWithProviders(<Sidebar />)

    expect(document.querySelector('[data-tour="nav-accounts"]')).not.toBeNull()
    expect(document.querySelector('[data-tour="nav-transactions"]')).not.toBeNull()
    expect(document.querySelector('[data-tour="nav-obligations"]')).not.toBeNull()
    expect(document.querySelector('[data-tour="nav-debts"]')).not.toBeNull()
    expect(document.querySelector('[data-tour="nav-credit"]')).not.toBeNull()
    expect(document.querySelector('[data-tour="nav-categories"]')).not.toBeNull()
    expect(document.querySelector('[data-tour="help-button"]')).not.toBeNull()
  })
})
