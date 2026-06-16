import 'reflect-metadata'
import { Reflector } from '@nestjs/core'
import { describe, expect, it, vi } from 'vitest'
import { PERMISSION_KEY } from '../../../../../../common/guards/role.guard'
import { ActiveTenantController } from '../active-tenant.controller'

describe('ActiveTenantController', () => {
  it('requires tenant selection permission rather than tenant management permission', () => {
    const reflector = new Reflector()

    const permission = reflector.get(
      PERMISSION_KEY,
      ActiveTenantController.prototype.setActiveTenant,
    )

    expect(permission).toBe('tenant:select')
  })

  it('sets the active tenant for the authenticated user', async () => {
    const sessionService = {
      setActiveTenant: vi.fn().mockResolvedValue(undefined),
    }
    const controller = new ActiveTenantController(sessionService as any)

    const result = await controller.setActiveTenant(
      { user: { id: 'user-1' } } as any,
      { tenantId: 'tenant-1' },
    )

    expect(sessionService.setActiveTenant).toHaveBeenCalledWith(
      'user-1',
      'tenant-1',
    )
    expect(result).toEqual({
      data: {
        activeTenantId: 'tenant-1',
      },
    })
  })
})
