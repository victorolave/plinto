import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConflictException, NotFoundException } from '@nestjs/common'
import { MembershipService } from '../membership.service'

describe('MembershipService', () => {
  let membershipRepo: {
    listMembersByTenantId: ReturnType<typeof vi.fn>
    updateRole: ReturnType<typeof vi.fn>
    remove: ReturnType<typeof vi.fn>
  }
  let sessionRepo: { clearActiveTenantForUser: ReturnType<typeof vi.fn> }
  let audit: { record: ReturnType<typeof vi.fn> }
  let service: MembershipService

  const changeRole = (overrides = {}) =>
    service.changeRole({
      tenantId: 'tenant-1',
      userId: 'user-sandra',
      role: 'viewer',
      actorUserId: 'user-owner',
      correlationId: 'req-1',
      ...overrides,
    })

  const removeMember = (overrides = {}) =>
    service.removeMember({
      tenantId: 'tenant-1',
      userId: 'user-sandra',
      actorUserId: 'user-owner',
      correlationId: 'req-1',
      ...overrides,
    })

  beforeEach(() => {
    membershipRepo = {
      listMembersByTenantId: vi.fn().mockResolvedValue([]),
      updateRole: vi.fn().mockResolvedValue('ok'),
      remove: vi.fn().mockResolvedValue('ok'),
    }
    sessionRepo = { clearActiveTenantForUser: vi.fn().mockResolvedValue({ count: 1 }) }
    audit = { record: vi.fn().mockResolvedValue(undefined) }

    service = new MembershipService(
      membershipRepo as never,
      sessionRepo as never,
      audit as never,
    )
  })

  describe('changeRole', () => {
    it('changes the role and records who did it', async () => {
      await changeRole()

      expect(membershipRepo.updateRole).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        userId: 'user-sandra',
        role: 'viewer',
      })
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'membership.role_changed',
          actorUserId: 'user-owner',
          metadata: { userId: 'user-sandra', role: 'viewer' },
        }),
      )
    })

    /**
     * A household with no owner cannot be administered by anybody, including
     * the person who emptied it — there is no way back short of database
     * access. 409 rather than 403: the caller is permitted to do this, the
     * household simply cannot be in the state it would produce.
     */
    it('refuses the demotion that would leave the household ownerless', async () => {
      membershipRepo.updateRole.mockResolvedValue('would_orphan')

      await expect(changeRole()).rejects.toBeInstanceOf(ConflictException)
    })

    it('reports not found for somebody who is not a member', async () => {
      membershipRepo.updateRole.mockResolvedValue('not_found')

      await expect(changeRole()).rejects.toBeInstanceOf(NotFoundException)
    })

    it.each(['would_orphan', 'not_found'] as const)(
      'records nothing when the write was refused (%s)',
      async (outcome) => {
        membershipRepo.updateRole.mockResolvedValue(outcome)

        await expect(changeRole()).rejects.toThrow()
        expect(audit.record).not.toHaveBeenCalled()
      },
    )
  })

  describe('removeMember', () => {
    it('removes the member and records who did it', async () => {
      await removeMember()

      expect(membershipRepo.remove).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        userId: 'user-sandra',
      })
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'membership.removed' }),
      )
    })

    it('refuses to remove the last owner', async () => {
      membershipRepo.remove.mockResolvedValue('would_orphan')

      await expect(removeMember()).rejects.toBeInstanceOf(ConflictException)
      expect(sessionRepo.clearActiveTenantForUser).not.toHaveBeenCalled()
    })

    /**
     * Their live sessions may still point at the household they just left, and
     * TenantGuard would reject every request from that point — which reads as a
     * broken dashboard rather than as "you are no longer here".
     */
    it('unpoints their live sessions from the household they left', async () => {
      await removeMember()

      expect(sessionRepo.clearActiveTenantForUser).toHaveBeenCalledWith(
        'user-sandra',
        'tenant-1',
      )
    })

    /**
     * Scoped to the household they were removed from. Somebody in two
     * households must not be ejected from the one they never left.
     */
    it('clears only the household in question, not every session they hold', async () => {
      await removeMember()

      const [, tenantId] = sessionRepo.clearActiveTenantForUser.mock.calls[0]
      expect(tenantId).toBe('tenant-1')
    })

    /**
     * The removal already happened and is what the caller asked for. Failing
     * the request now would report an error for work that succeeded.
     */
    it('still succeeds when clearing the session fails', async () => {
      sessionRepo.clearActiveTenantForUser.mockRejectedValue(new Error('session store down'))

      await expect(removeMember()).resolves.toBeUndefined()
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'membership.removed' }),
      )
    })

    it('does not touch sessions for somebody who was never a member', async () => {
      membershipRepo.remove.mockResolvedValue('not_found')

      await expect(removeMember()).rejects.toBeInstanceOf(NotFoundException)
      expect(sessionRepo.clearActiveTenantForUser).not.toHaveBeenCalled()
    })
  })
})
