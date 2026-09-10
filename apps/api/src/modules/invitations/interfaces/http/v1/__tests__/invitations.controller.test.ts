import 'reflect-metadata'
import { Reflector } from '@nestjs/core'
import { describe, expect, it, vi } from 'vitest'
import { PERMISSION_KEY } from '../../../../../../common/guards/role.guard'
import { InvitationsController } from '../invitations.controller'
import type { InvitationService } from '../../../../application/invitation.service'
import type { RequestContext } from '../../../../../../common/types/request-context'

const makeService = () => ({
  listPending: vi.fn().mockResolvedValue([]),
  invite: vi.fn().mockResolvedValue({ status: 'pending', invitation: null, member: null }),
  revoke: vi.fn().mockResolvedValue(undefined),
})

const controllerWith = (service: ReturnType<typeof makeService>) =>
  new InvitationsController(service as unknown as InvitationService)

describe('InvitationsController', () => {
  /**
   * Reading the roster is everyone's business; changing who is on it is not.
   * All three routes therefore sit behind the owner-only permission.
   */
  it.each([
    ['listInvitations'],
    ['createInvitation'],
    ['revokeInvitation'],
  ] as const)('requires member:invite to %s', (method) => {
    const reflector = new Reflector()

    expect(reflector.get(PERMISSION_KEY, InvitationsController.prototype[method])).toBe(
      'member:invite',
    )
  })

  it('invites on behalf of the signed-in user, into the guard-resolved tenant', async () => {
    const service = makeService()

    await controllerWith(service).createInvitation(
      {
        tenantId: 'tenant-1',
        user: { id: 'user-owner' },
        requestId: 'req-1',
      } as RequestContext,
      { email: 'sandra@example.com', role: 'member' },
    )

    expect(service.invite).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      email: 'sandra@example.com',
      role: 'member',
      invitedByUserId: 'user-owner',
      correlationId: 'req-1',
    })
  })

  /**
   * The tenant must come from `req.tenantId`, which TenantGuard sets after
   * verifying membership. A tenant taken from the body would be an unverified
   * second source, and here it would mean inviting somebody into a household
   * the caller does not belong to.
   */
  it('never takes the tenant from caller-supplied input', async () => {
    const service = makeService()

    await controllerWith(service).createInvitation(
      {
        tenantId: 'tenant-from-guard',
        user: { id: 'user-owner' },
        requestId: 'req-1',
        body: { tenantId: 'tenant-attacker' },
      } as unknown as RequestContext,
      { email: 'sandra@example.com', role: 'member' },
    )

    expect(service.invite).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-from-guard' }),
    )
  })

  it('scopes a revoke to the active tenant', async () => {
    const service = makeService()

    await controllerWith(service).revokeInvitation(
      { tenantId: 'tenant-1', user: { id: 'user-owner' }, requestId: 'req-1' } as RequestContext,
      'inv-1',
    )

    expect(service.revoke).toHaveBeenCalledWith({
      invitationId: 'inv-1',
      tenantId: 'tenant-1',
      actorUserId: 'user-owner',
      correlationId: 'req-1',
    })
  })

  it('lists only the active tenant’s invitations', async () => {
    const service = makeService()
    service.listPending.mockResolvedValue([{ id: 'inv-1' }])

    const result = await controllerWith(service).listInvitations({
      tenantId: 'tenant-1',
    } as RequestContext)

    expect(service.listPending).toHaveBeenCalledWith('tenant-1')
    expect(result).toEqual({ data: { invitations: [{ id: 'inv-1' }] } })
  })
})
