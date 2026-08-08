import 'reflect-metadata'
import { Reflector } from '@nestjs/core'
import { describe, expect, it, vi } from 'vitest'
import { PERMISSION_KEY } from '../../../../../../common/guards/role.guard'
import { MembersController } from '../members.controller'
import type { MembershipService } from '../../../../application/membership.service'
import type { RequestContext } from '../../../../../../common/types/request-context'

describe('MembersController', () => {
  it('requires member:read to list members', () => {
    const reflector = new Reflector()

    const permission = reflector.get(
      PERMISSION_KEY,
      MembersController.prototype.listMembers,
    )

    expect(permission).toBe('member:read')
  })

  it('lists the members of the tenant the guards resolved', async () => {
    const members = [
      {
        userId: 'user-1',
        email: 'victor@example.com',
        name: 'Victor',
        role: 'owner' as const,
        joinedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]
    const service = { listMembers: vi.fn().mockResolvedValue(members) }
    const controller = new MembersController(service as unknown as MembershipService)

    const result = await controller.listMembers({
      tenantId: 'tenant-1',
    } as RequestContext)

    expect(service.listMembers).toHaveBeenCalledWith('tenant-1')
    expect(result).toEqual({ data: { members } })
  })

  /**
   * The tenant must come from `req.tenantId`, which TenantGuard sets after
   * verifying membership — never from anything the caller supplies directly.
   * A controller reading a tenant off the body or query would bypass that
   * check, so this pins the source.
   */
  it('never reads the tenant from caller-supplied input', async () => {
    const service = { listMembers: vi.fn().mockResolvedValue([]) }
    const controller = new MembersController(service as unknown as MembershipService)

    await controller.listMembers({
      tenantId: 'tenant-from-guard',
      body: { tenantId: 'tenant-attacker' },
      query: { tenantId: 'tenant-attacker' },
    } as unknown as RequestContext)

    expect(service.listMembers).toHaveBeenCalledWith('tenant-from-guard')
  })
})
