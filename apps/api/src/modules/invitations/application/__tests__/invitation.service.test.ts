import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConflictException, NotFoundException } from '@nestjs/common'
import { InvitationService } from '../invitation.service'
import { INVITATION_TTL_DAYS } from '../../domain/invitation.entity'

const NOW = new Date('2026-08-08T00:00:00.000Z')

const makeInvitation = (overrides = {}) => ({
  id: 'inv-1',
  tenantId: 'tenant-1',
  email: 'sandra@example.com',
  role: 'member' as const,
  invitedByUserId: 'user-owner',
  expiresAt: new Date(NOW.getTime() + 24 * 60 * 60 * 1000),
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
})

const makeUser = (overrides = {}) => ({
  id: 'user-sandra',
  idpSub: 'sub-sandra',
  email: 'sandra@example.com',
  name: 'Sandra',
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
})

const makeMembership = (overrides = {}) => ({
  id: 'mem-1',
  tenantId: 'tenant-1',
  userId: 'user-sandra',
  role: 'member' as const,
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
})

describe('InvitationService', () => {
  let invitationRepo: {
    upsert: ReturnType<typeof vi.fn>
    listByTenantId: ReturnType<typeof vi.fn>
    listByEmail: ReturnType<typeof vi.fn>
    findById: ReturnType<typeof vi.fn>
    deleteByIdForTenant: ReturnType<typeof vi.fn>
    deleteById: ReturnType<typeof vi.fn>
  }
  let membershipRepo: {
    create: ReturnType<typeof vi.fn>
    findByUserAndTenant: ReturnType<typeof vi.fn>
  }
  let userRepo: { findByEmail: ReturnType<typeof vi.fn> }
  let audit: { record: ReturnType<typeof vi.fn> }
  let service: InvitationService

  beforeEach(() => {
    invitationRepo = {
      upsert: vi.fn(),
      listByTenantId: vi.fn(),
      listByEmail: vi.fn().mockResolvedValue([]),
      findById: vi.fn(),
      deleteByIdForTenant: vi.fn(),
      deleteById: vi.fn().mockResolvedValue(true),
    }
    membershipRepo = {
      create: vi.fn().mockResolvedValue(makeMembership()),
      findByUserAndTenant: vi.fn().mockResolvedValue(null),
    }
    userRepo = { findByEmail: vi.fn().mockResolvedValue(null) }
    audit = { record: vi.fn().mockResolvedValue(undefined) }

    service = new InvitationService(
      invitationRepo as never,
      membershipRepo as never,
      userRepo as never,
      audit as never,
    )
  })

  describe('invite', () => {
    it('leaves an invitation pending when nobody holds that address yet', async () => {
      invitationRepo.upsert.mockResolvedValue(makeInvitation())

      const result = await service.invite({
        tenantId: 'tenant-1',
        email: 'sandra@example.com',
        role: 'member',
        invitedByUserId: 'user-owner',
        correlationId: 'req-1',
        now: NOW,
      })

      expect(result.status).toBe('pending')
      expect(result.member).toBeNull()
      expect(membershipRepo.create).not.toHaveBeenCalled()
    })

    /**
     * The reason `claimFor` is not only called at login. Somebody already
     * signed in would otherwise not see the household until they logged out.
     */
    it('admits an existing user immediately instead of leaving them waiting', async () => {
      userRepo.findByEmail.mockResolvedValue(makeUser())
      invitationRepo.upsert.mockResolvedValue(makeInvitation())

      const result = await service.invite({
        tenantId: 'tenant-1',
        email: 'sandra@example.com',
        role: 'member',
        invitedByUserId: 'user-owner',
        correlationId: 'req-1',
        now: NOW,
      })

      expect(result.status).toBe('accepted')
      expect(result.member).toMatchObject({ userId: 'user-sandra', role: 'member' })
      expect(membershipRepo.create).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        userId: 'user-sandra',
        role: 'member',
      })
      expect(invitationRepo.deleteById).toHaveBeenCalledWith('inv-1')
    })

    it('refuses to invite somebody who is already a member', async () => {
      userRepo.findByEmail.mockResolvedValue(makeUser())
      membershipRepo.findByUserAndTenant.mockResolvedValue(makeMembership())

      await expect(
        service.invite({
          tenantId: 'tenant-1',
          email: 'sandra@example.com',
          role: 'member',
          invitedByUserId: 'user-owner',
          correlationId: 'req-1',
          now: NOW,
        }),
      ).rejects.toBeInstanceOf(ConflictException)

      // Rejected before anything is written, so no row can be left behind that
      // could never be claimed.
      expect(invitationRepo.upsert).not.toHaveBeenCalled()
    })

    it('normalises the address so one person cannot hold two invitations', async () => {
      invitationRepo.upsert.mockResolvedValue(makeInvitation())

      await service.invite({
        tenantId: 'tenant-1',
        email: '  Sandra@Example.COM  ',
        role: 'viewer',
        invitedByUserId: 'user-owner',
        correlationId: 'req-1',
        now: NOW,
      })

      expect(invitationRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'sandra@example.com' }),
      )
      expect(userRepo.findByEmail).toHaveBeenCalledWith('sandra@example.com')
    })

    it('dates the offer from the invite, not from some fixed calendar point', async () => {
      invitationRepo.upsert.mockResolvedValue(makeInvitation())

      await service.invite({
        tenantId: 'tenant-1',
        email: 'sandra@example.com',
        role: 'member',
        invitedByUserId: 'user-owner',
        correlationId: 'req-1',
        now: NOW,
      })

      const expiresAt = invitationRepo.upsert.mock.calls[0][0].expiresAt as Date
      const days = (expiresAt.getTime() - NOW.getTime()) / (24 * 60 * 60 * 1000)
      expect(days).toBe(INVITATION_TTL_DAYS)
    })

    it('records who invited whom, with what role', async () => {
      invitationRepo.upsert.mockResolvedValue(makeInvitation())

      await service.invite({
        tenantId: 'tenant-1',
        email: 'sandra@example.com',
        role: 'viewer',
        invitedByUserId: 'user-owner',
        correlationId: 'req-1',
        now: NOW,
      })

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'membership.invited',
          actorUserId: 'user-owner',
          metadata: { email: 'sandra@example.com', role: 'viewer' },
        }),
      )
    })
  })

  describe('claimFor', () => {
    it('turns a standing invitation into a membership', async () => {
      invitationRepo.listByEmail.mockResolvedValue([makeInvitation()])

      const claimed = await service.claimFor(makeUser(), {
        correlationId: 'req-1',
        now: NOW,
      })

      expect(claimed).toHaveLength(1)
      expect(membershipRepo.create).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        userId: 'user-sandra',
        role: 'member',
      })
    })

    it('claims every household that invited the same person', async () => {
      invitationRepo.listByEmail.mockResolvedValue([
        makeInvitation({ id: 'inv-1', tenantId: 'tenant-1' }),
        makeInvitation({ id: 'inv-2', tenantId: 'tenant-2', role: 'viewer' }),
      ])

      const claimed = await service.claimFor(makeUser(), {
        correlationId: 'req-1',
        now: NOW,
      })

      expect(claimed).toHaveLength(2)
      expect(membershipRepo.create).toHaveBeenCalledTimes(2)
    })

    it('does not honour an expired offer, and clears it away', async () => {
      const expired = makeInvitation({
        expiresAt: new Date(NOW.getTime() - 1000),
      })
      invitationRepo.listByEmail.mockResolvedValue([expired])

      const claimed = await service.claimFor(makeUser(), {
        correlationId: 'req-1',
        now: NOW,
      })

      expect(claimed).toEqual([])
      expect(membershipRepo.create).not.toHaveBeenCalled()
      expect(invitationRepo.deleteById).toHaveBeenCalledWith('inv-1')
    })

    /**
     * Two claims can race — an invite that admits an existing user while that
     * user is signing in. The second must be a no-op, not a duplicate
     * membership or an error thrown into a login.
     */
    it('is a no-op when the membership already exists', async () => {
      invitationRepo.listByEmail.mockResolvedValue([makeInvitation()])
      membershipRepo.findByUserAndTenant.mockResolvedValue(makeMembership())

      const claimed = await service.claimFor(makeUser(), {
        correlationId: 'req-1',
        now: NOW,
      })

      expect(claimed).toEqual([])
      expect(membershipRepo.create).not.toHaveBeenCalled()
      expect(invitationRepo.deleteById).toHaveBeenCalledWith('inv-1')
    })

    /**
     * If the process dies between creating the membership and deleting the
     * invitation, the offer is still standing and the next claim cleans it up.
     * The other order would drop the offer and leave the person outside with
     * nothing to retry.
     */
    it('creates the membership before consuming the invitation', async () => {
      const order: string[] = []
      invitationRepo.listByEmail.mockResolvedValue([makeInvitation()])
      membershipRepo.create.mockImplementation(async () => {
        order.push('membership')
        return makeMembership()
      })
      invitationRepo.deleteById.mockImplementation(async () => {
        order.push('delete')
        return true
      })

      await service.claimFor(makeUser(), { correlationId: 'req-1', now: NOW })

      expect(order).toEqual(['membership', 'delete'])
    })

    it('grants the role the invitation carried, not a default', async () => {
      invitationRepo.listByEmail.mockResolvedValue([makeInvitation({ role: 'viewer' })])
      membershipRepo.create.mockResolvedValue(makeMembership({ role: 'viewer' }))

      const claimed = await service.claimFor(makeUser(), {
        correlationId: 'req-1',
        now: NOW,
      })

      expect(claimed[0].role).toBe('viewer')
      expect(membershipRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'viewer' }),
      )
    })

    it('returns nothing when there is nothing addressed to this person', async () => {
      const claimed = await service.claimFor(makeUser(), {
        correlationId: 'req-1',
        now: NOW,
      })

      expect(claimed).toEqual([])
      expect(membershipRepo.create).not.toHaveBeenCalled()
    })
  })

  describe('revoke', () => {
    it('deletes the invitation and records who revoked it', async () => {
      invitationRepo.deleteByIdForTenant.mockResolvedValue(true)

      await service.revoke({
        invitationId: 'inv-1',
        tenantId: 'tenant-1',
        actorUserId: 'user-owner',
        correlationId: 'req-1',
      })

      expect(invitationRepo.deleteByIdForTenant).toHaveBeenCalledWith('inv-1', 'tenant-1')
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'membership.invitation_revoked' }),
      )
    })

    /**
     * Scoped to the tenant in the repository, so revoking another household's
     * invitation by guessing its id reads as "not found" — the id is not proof
     * of anything on its own.
     */
    it('reports not found when the invitation belongs to another household', async () => {
      invitationRepo.deleteByIdForTenant.mockResolvedValue(false)

      await expect(
        service.revoke({
          invitationId: 'inv-other',
          tenantId: 'tenant-1',
          actorUserId: 'user-owner',
          correlationId: 'req-1',
        }),
      ).rejects.toBeInstanceOf(NotFoundException)

      expect(audit.record).not.toHaveBeenCalled()
    })
  })
})
