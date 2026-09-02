import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/render-with-providers'
import { BottomNav } from '../bottom-nav'

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

vi.mock('../../../features/onboarding/tour/use-product-tour', () => ({
  useProductTour: () => ({ start, isRunning: false }),
}))

describe('BottomNav', () => {
  it('starts the product tour and closes the sheet from the help item', async () => {
    renderWithProviders(<BottomNav onAdd={vi.fn()} />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'More' }))
    const helpItem = document.querySelector('[data-tour="help-more-item"]') as HTMLElement
    expect(helpItem).not.toBeNull()

    await user.click(helpItem)

    expect(start).toHaveBeenCalledTimes(1)
    expect(document.querySelector('[data-tour="help-more-item"]')).toBeNull()
  })
})
