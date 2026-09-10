import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/render-with-providers'
import HelpPage from '../page'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('../../../../components/layout/dashboard-context', () => ({
  useDashboard: () => ({ activeTenantId: 'tenant-1' }),
}))

vi.mock('../../../../features/onboarding/tour/product-tour-context', () => ({
  useProductTour: () => ({ start: vi.fn(), isRunning: false }),
}))

vi.mock('../../../../features/dashboard/components/first-steps-card', () => ({
  showFirstStepsAgain: vi.fn(),
}))

describe('HelpPage', () => {
  it('renders the help card', () => {
    renderWithProviders(<HelpPage />)

    expect(screen.getByRole('button', { name: 'Take the tour' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show first steps' })).toBeInTheDocument()
  })
})
