import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/render-with-providers'
import { ExampleHouseholdCard } from '../example-household-card'

vi.mock('../../../tenants/services/demo-household')
vi.mock('../../../tenants/services/tenant-selection')

const mockedOnSelectTenant = vi.fn()

/** Renders in Spanish — this component's copy is asserted in Spanish, matching `locale`. */
function renderCard() {
  return renderWithProviders(<ExampleHouseholdCard />, { locale: 'es' })
}

vi.mock('../../../../components/layout/dashboard-context', () => ({
  useDashboard: vi.fn(),
}))

import { createDemoHousehold, deleteDemoHousehold } from '../../../tenants/services/demo-household'
import { selectTenant } from '../../../tenants/services/tenant-selection'
import { useDashboard } from '../../../../components/layout/dashboard-context'

const mockedCreateDemoHousehold = vi.mocked(createDemoHousehold)
const mockedDeleteDemoHousehold = vi.mocked(deleteDemoHousehold)
const mockedSelectTenant = vi.mocked(selectTenant)
const mockedUseDashboard = vi.mocked(useDashboard)

const originalLocation = window.location

beforeEach(() => {
  vi.clearAllMocks()
  mockedOnSelectTenant.mockClear()
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...originalLocation, reload: vi.fn() },
  })
})

function setTenants(tenants: Array<{ id: string; name: string; isDemo: boolean }>) {
  mockedUseDashboard.mockReturnValue({
    tenants,
    onSelectTenant: mockedOnSelectTenant,
  } as any)
}

describe('ExampleHouseholdCard', () => {
  describe('when the user has no demo household', () => {
    beforeEach(() => {
      setTenants([{ id: 'tenant-1', name: 'Mi hogar', isDemo: false }])
    })

    it('shows the explanation and the create button', () => {
      renderCard()

      expect(screen.getByText(/hogar aparte con datos inventados/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Crear hogar de ejemplo' })).toBeInTheDocument()
    })

    it('calls the create service with the current locale and reloads on success', async () => {
      mockedCreateDemoHousehold.mockResolvedValue({
        data: { tenant: { id: 'demo-1', name: 'Hogar de ejemplo', isDemo: true } },
      })
      const user = userEvent.setup()

      renderCard()
      await user.click(screen.getByRole('button', { name: 'Crear hogar de ejemplo' }))

      await waitFor(() => expect(mockedCreateDemoHousehold).toHaveBeenCalledWith('es'))
      await waitFor(() => expect(window.location.reload).toHaveBeenCalledTimes(1))
    })

    it('shows an error message when creation fails', async () => {
      mockedCreateDemoHousehold.mockRejectedValue(new Error('Something broke'))
      const user = userEvent.setup()

      renderCard()
      await user.click(screen.getByRole('button', { name: 'Crear hogar de ejemplo' }))

      expect(await screen.findByText('Something broke')).toBeInTheDocument()
    })
  })

  describe('when the user already has a demo household', () => {
    beforeEach(() => {
      setTenants([
        { id: 'tenant-1', name: 'Mi hogar', isDemo: false },
        { id: 'demo-1', name: 'Hogar de ejemplo', isDemo: true },
      ])
    })

    it('shows the existing-household message and both action buttons', () => {
      renderCard()

      expect(screen.getByText('Ya tienes un hogar de ejemplo.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Ir al hogar de ejemplo' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Eliminar hogar de ejemplo' })).toBeInTheDocument()
    })

    it('selects the demo tenant when "go to" is clicked', async () => {
      const user = userEvent.setup()
      renderCard()

      await user.click(screen.getByRole('button', { name: 'Ir al hogar de ejemplo' }))

      expect(mockedOnSelectTenant).toHaveBeenCalledWith('demo-1')
    })

    it('opens a confirmation modal before deleting, and does not delete on cancel', async () => {
      const user = userEvent.setup()
      renderCard()

      await user.click(screen.getByRole('button', { name: 'Eliminar hogar de ejemplo' }))
      expect(await screen.findByRole('dialog')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Cancelar' }))

      expect(mockedDeleteDemoHousehold).not.toHaveBeenCalled()
    })

    it('deletes the demo household, selects a non-demo tenant, then reloads', async () => {
      mockedDeleteDemoHousehold.mockResolvedValue(undefined)
      mockedSelectTenant.mockResolvedValue(undefined)
      const user = userEvent.setup()

      renderCard()
      await user.click(screen.getByRole('button', { name: 'Eliminar hogar de ejemplo' }))
      await screen.findByRole('dialog')
      await user.click(screen.getByRole('button', { name: 'Eliminar' }))

      await waitFor(() => expect(mockedDeleteDemoHousehold).toHaveBeenCalledWith('demo-1'))
      expect(mockedSelectTenant).toHaveBeenCalledWith('tenant-1')
      await waitFor(() => expect(window.location.reload).toHaveBeenCalledTimes(1))
    })
  })
})
