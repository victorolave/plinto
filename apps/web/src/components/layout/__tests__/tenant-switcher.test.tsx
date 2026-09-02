import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/render-with-providers'
import { TenantSwitcher } from '../tenant-switcher'

describe('TenantSwitcher', () => {
  it('shows the "example" badge next to a demo household in the option list', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <TenantSwitcher
        tenants={[
          { id: 'tenant-1', name: 'My household', isDemo: false },
          { id: 'demo-1', name: 'Example household', isDemo: true },
        ]}
        activeTenantId="tenant-1"
        onSelect={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: /My household/i }))

    const options = screen.getAllByRole('option')
    const demoOption = options.find((option) => option.textContent?.includes('Example household'))
    expect(demoOption?.textContent).toContain('example')

    const realOption = options.find((option) => option.textContent?.includes('My household'))
    expect(realOption?.textContent).not.toContain('example')
  })

  it('does not show the badge on the trigger for a non-demo active household', () => {
    renderWithProviders(
      <TenantSwitcher
        tenants={[{ id: 'tenant-1', name: 'My household', isDemo: false }]}
        activeTenantId="tenant-1"
        onSelect={vi.fn()}
      />,
    )

    expect(screen.queryByText('example')).not.toBeInTheDocument()
  })

  it('shows the badge on the trigger when the active household is the demo one', () => {
    renderWithProviders(
      <TenantSwitcher
        tenants={[{ id: 'demo-1', name: 'Example household', isDemo: true }]}
        activeTenantId="demo-1"
        onSelect={vi.fn()}
      />,
    )

    expect(screen.getByText('example')).toBeInTheDocument()
  })
})
