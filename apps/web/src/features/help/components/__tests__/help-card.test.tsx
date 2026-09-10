import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/render-with-providers'
import { HelpCard } from '../help-card'

const push = vi.fn()
const start = vi.fn()
let isRunning = false

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

vi.mock('../../../../components/layout/dashboard-context', () => ({
  useDashboard: () => ({ activeTenantId: 'tenant-1' }),
}))

vi.mock('../../../onboarding/tour/product-tour-context', () => ({
  useProductTour: () => ({ start, isRunning }),
}))

vi.mock('../../../dashboard/components/first-steps-card', () => ({
  showFirstStepsAgain: vi.fn(),
}))

import { showFirstStepsAgain } from '../../../dashboard/components/first-steps-card'

const mockedShowFirstStepsAgain = vi.mocked(showFirstStepsAgain)

beforeEach(() => {
  vi.clearAllMocks()
  isRunning = false
})

describe('HelpCard', () => {
  it('renders both the tour and first-steps buttons', () => {
    renderWithProviders(<HelpCard />)

    expect(screen.getByRole('button', { name: 'Take the tour' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show first steps' })).toBeInTheDocument()
  })

  it('starts the tour when "Take the tour" is clicked', async () => {
    const user = userEvent.setup()
    renderWithProviders(<HelpCard />)

    await user.click(screen.getByRole('button', { name: 'Take the tour' }))

    expect(start).toHaveBeenCalledTimes(1)
  })

  it('clears the first-steps dismissal for the active tenant and navigates to /dashboard', async () => {
    const user = userEvent.setup()
    renderWithProviders(<HelpCard />)

    await user.click(screen.getByRole('button', { name: 'Show first steps' }))

    expect(mockedShowFirstStepsAgain).toHaveBeenCalledWith('tenant-1')
    expect(push).toHaveBeenCalledWith('/dashboard')
  })

  it('disables the tour button while a tour is already running', () => {
    isRunning = true
    renderWithProviders(<HelpCard />)

    expect(screen.getByRole('button', { name: 'Take the tour' })).toBeDisabled()
  })
})
