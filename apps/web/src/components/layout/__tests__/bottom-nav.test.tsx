import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/render-with-providers'
import { BottomNav } from '../bottom-nav'

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

describe('BottomNav', () => {
  it('tags the always-visible accounts/transactions bar links with the sidebar\'s data-tour anchors', () => {
    renderWithProviders(<BottomNav onAdd={vi.fn()} />)

    expect(document.querySelector('[data-tour="nav-accounts"]')).not.toBeNull()
    expect(document.querySelector('[data-tour="nav-transactions"]')).not.toBeNull()
  })

  it('lists Help in the "More" sheet, linking to the help page', async () => {
    renderWithProviders(<BottomNav onAdd={vi.fn()} />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'More' }))
    const helpItem = document.querySelector('[data-tour="nav-help"]') as HTMLElement
    expect(helpItem).not.toBeNull()
    expect(helpItem.getAttribute('href')).toBe('/dashboard/help')
    expect(helpItem.textContent).toContain('Help')
  })
})
