import { describe, expect, it, vi } from 'vitest'
import { TenantsController } from '../tenants.controller'

describe('TenantsController', () => {
  it('lists tenants and memberships for the authenticated user', async () => {
    const tenantService = {
      listTenantsForUser: vi.fn().mockResolvedValue({
        tenants: [{ id: 'tenant-1' }],
        memberships: [{ id: 'mem-1' }],
      }),
    }
    const onboardingService = { completeOnboarding: vi.fn() }
    const controller = new TenantsController(onboardingService as any, tenantService as any)

    const result = await controller.listTenants({
      user: { id: 'user-1' },
    } as any)

    expect(tenantService.listTenantsForUser).toHaveBeenCalledWith('user-1')
    expect(result).toEqual({
      data: {
        tenants: [{ id: 'tenant-1' }],
        memberships: [{ id: 'mem-1' }],
      },
    })
  })

  it('creates a tenant through the onboarding service using the authenticated user', async () => {
    const onboardingService = {
      completeOnboarding: vi.fn().mockResolvedValue({
        tenant: { id: 'tenant-1' },
        membership: { id: 'mem-1' },
      }),
    }
    const tenantService = { listTenantsForUser: vi.fn() }
    const controller = new TenantsController(onboardingService as any, tenantService as any)

    const result = await controller.createTenant(
      { user: { id: 'user-1' }, requestId: 'corr-1' } as any,
      { name: 'Acme Corp', baseCurrency: 'USD' },
    )

    expect(onboardingService.completeOnboarding).toHaveBeenCalledWith({
      userId: 'user-1',
      tenantName: 'Acme Corp',
      baseCurrency: 'USD',
      requestId: 'corr-1',
    })
    expect(result).toEqual({
      data: {
        tenant: { id: 'tenant-1' },
        membership: { id: 'mem-1' },
      },
    })
  })
})
