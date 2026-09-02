import { describe, expect, it, vi } from 'vitest'
import { DemoHouseholdController } from '../demo-household.controller'

describe('DemoHouseholdController', () => {
  it('creates the example household for the authenticated user with the given locale', async () => {
    const demoHouseholdService = {
      createForUser: vi.fn().mockResolvedValue({ id: 'tenant-1', name: 'Hogar de ejemplo', isDemo: true }),
      deleteForUser: vi.fn(),
    }
    const controller = new DemoHouseholdController(demoHouseholdService as any)

    const result = await controller.createDemoHousehold(
      { user: { id: 'user-1' }, requestId: 'corr-1' } as any,
      { locale: 'en' },
    )

    expect(demoHouseholdService.createForUser).toHaveBeenCalledWith({
      userId: 'user-1',
      locale: 'en',
      correlationId: 'corr-1',
    })
    expect(result).toEqual({ data: { tenant: { id: 'tenant-1', name: 'Hogar de ejemplo', isDemo: true } } })
  })

  it('defaults locale to undefined (service applies "es") when the body omits it', async () => {
    const demoHouseholdService = {
      createForUser: vi.fn().mockResolvedValue({ id: 'tenant-1' }),
      deleteForUser: vi.fn(),
    }
    const controller = new DemoHouseholdController(demoHouseholdService as any)

    await controller.createDemoHousehold({ user: { id: 'user-1' }, requestId: 'corr-1' } as any, {})

    expect(demoHouseholdService.createForUser).toHaveBeenCalledWith(
      expect.objectContaining({ locale: undefined }),
    )
  })

  it('deletes the household named by the id path param for the authenticated user', async () => {
    const demoHouseholdService = {
      createForUser: vi.fn(),
      deleteForUser: vi.fn().mockResolvedValue(undefined),
    }
    const controller = new DemoHouseholdController(demoHouseholdService as any)

    const result = await controller.deleteDemoHousehold(
      { user: { id: 'user-1' }, requestId: 'corr-1' } as any,
      'tenant-1',
    )

    expect(demoHouseholdService.deleteForUser).toHaveBeenCalledWith({
      userId: 'user-1',
      tenantId: 'tenant-1',
      correlationId: 'corr-1',
    })
    expect(result).toBeUndefined()
  })
})
