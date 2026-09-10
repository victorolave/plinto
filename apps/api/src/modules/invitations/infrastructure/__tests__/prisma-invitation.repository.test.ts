import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PrismaInvitationRepository } from '../prisma-invitation.repository'
import type { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service'

const makePrisma = () => ({
  invitation: {
    upsert: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn(),
    deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
  },
})

describe('PrismaInvitationRepository', () => {
  let prisma: ReturnType<typeof makePrisma>
  let repository: PrismaInvitationRepository

  beforeEach(() => {
    prisma = makePrisma()
    repository = new PrismaInvitationRepository(prisma as unknown as PrismaService)
  })

  describe('upsert', () => {
    /**
     * The unique index on (tenant_id, email) only means "one pending invitation
     * per person" if the column holds one spelling per person. Postgres cannot
     * enforce that here — Prisma has no way to declare a lower(email) index, and
     * writing one by hand would show up as schema drift — so this adapter is
     * the last place it can be guaranteed.
     */
    it('lower-cases and trims the address before it reaches the unique index', async () => {
      await repository.upsert({
        tenantId: 'tenant-1',
        email: '  Sandra@Example.COM  ',
        role: 'member',
        invitedByUserId: 'user-owner',
        expiresAt: new Date('2026-08-22T00:00:00.000Z'),
      })

      const args = prisma.invitation.upsert.mock.calls[0][0]
      expect(args.where).toEqual({
        tenantId_email: { tenantId: 'tenant-1', email: 'sandra@example.com' },
      })
      expect(args.create.email).toBe('sandra@example.com')
    })

    // Re-inviting is how somebody corrects a role they picked wrong. It should
    // replace the offer, not stack a second one or need a revoke first.
    it('replaces the standing offer rather than stacking another', async () => {
      await repository.upsert({
        tenantId: 'tenant-1',
        email: 'sandra@example.com',
        role: 'viewer',
        invitedByUserId: 'user-other-owner',
        expiresAt: new Date('2026-08-22T00:00:00.000Z'),
      })

      const args = prisma.invitation.upsert.mock.calls[0][0]
      expect(args.update).toEqual({
        role: 'viewer',
        invitedByUserId: 'user-other-owner',
        expiresAt: new Date('2026-08-22T00:00:00.000Z'),
      })
      expect(args.update).not.toHaveProperty('email')
    })
  })

  describe('listByEmail', () => {
    it('normalises the address it searches by', async () => {
      await repository.listByEmail('  SANDRA@example.com ')

      expect(prisma.invitation.findMany).toHaveBeenCalledWith({
        where: { email: 'sandra@example.com' },
        orderBy: { createdAt: 'asc' },
      })
    })
  })

  describe('listByTenantId', () => {
    it('orders stably so the list does not reshuffle between renders', async () => {
      await repository.listByTenantId('tenant-1')

      expect(prisma.invitation.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' },
        orderBy: [{ createdAt: 'asc' }, { email: 'asc' }],
      })
    })
  })

  describe('deleteByIdForTenant', () => {
    /**
     * `deleteMany`, not `delete`: Prisma throws when `delete` matches nothing,
     * and "this invitation is not yours" has to read as not-found, never as a
     * 500 that also confirms the id exists.
     */
    it('scopes the delete to the tenant and reports whether anything matched', async () => {
      prisma.invitation.deleteMany.mockResolvedValue({ count: 0 })

      const deleted = await repository.deleteByIdForTenant('inv-1', 'tenant-1')

      expect(prisma.invitation.deleteMany).toHaveBeenCalledWith({
        where: { id: 'inv-1', tenantId: 'tenant-1' },
      })
      expect(deleted).toBe(false)
    })

    it('reports true when a row was removed', async () => {
      prisma.invitation.deleteMany.mockResolvedValue({ count: 1 })

      await expect(repository.deleteByIdForTenant('inv-1', 'tenant-1')).resolves.toBe(true)
    })
  })

  describe('deleteById', () => {
    // Used by claiming, which already knows the invitation is the one it just
    // read, and runs across tenants.
    it('deletes without a tenant scope', async () => {
      await repository.deleteById('inv-1')

      expect(prisma.invitation.deleteMany).toHaveBeenCalledWith({ where: { id: 'inv-1' } })
    })
  })
})
