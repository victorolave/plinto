import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../../test/render-with-providers'
import { Sidebar } from '../sidebar'

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

describe('Sidebar', () => {
  it('renders a Help link below Settings, and no help icon button', () => {
    renderWithProviders(<Sidebar />)

    const settings = document.querySelector('[data-tour="nav-settings"]')
    const help = document.querySelector('[data-tour="nav-help"]')
    expect(settings).not.toBeNull()
    expect(help).not.toBeNull()
    expect(help?.getAttribute('href')).toBe('/dashboard/help')

    // Help must render below Settings in the sidebar footer.
    const position = settings!.compareDocumentPosition(help!)
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    expect(document.querySelector('[data-tour="help-button"]')).toBeNull()
  })

  it('tags navigation links with data-tour anchors', () => {
    renderWithProviders(<Sidebar />)

    expect(document.querySelector('[data-tour="nav-accounts"]')).not.toBeNull()
    expect(document.querySelector('[data-tour="nav-transactions"]')).not.toBeNull()
    expect(document.querySelector('[data-tour="nav-obligations"]')).not.toBeNull()
    expect(document.querySelector('[data-tour="nav-debts"]')).not.toBeNull()
    expect(document.querySelector('[data-tour="nav-credit"]')).not.toBeNull()
    expect(document.querySelector('[data-tour="nav-categories"]')).not.toBeNull()
  })
})
