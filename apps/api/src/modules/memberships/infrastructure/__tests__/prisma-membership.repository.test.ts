import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PrismaMembershipRepository } from '../prisma-membership.repository'
import type { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service'

const makePrisma = () => ({
  membership: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
})

const makeMembership = (overrides = {}) => ({
  id: 'membership-1',
  tenantId: 'tenant-1',
  userId: 'user-1',
  role: 'owner' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

describe('PrismaMembershipRepository', () => {
  let prisma: ReturnType<typeof makePrisma>
  let repository: PrismaMembershipRepository

  beforeEach(() => {
    prisma = makePrisma()
    repository = new PrismaMembershipRepository(prisma as unknown as PrismaService)
  })

  describe('create', () => {
    it('creates the membership with tenantId, userId, and role', async () => {
      const membership = makeMembership()
      prisma.membership.create.mockResolvedValue(membership)

      const result = await repository.create({
        tenantId: 'tenant-1',
        userId: 'user-1',
        role: 'owner',
      })

      expect(prisma.membership.create).toHaveBeenCalledWith({
        data: { tenantId: 'tenant-1', userId: 'user-1', role: 'owner' },
      })
      expect(result).toBe(membership)
    })
  })

  describe('listByUserId', () => {
    it('scopes the listing to the given user', async () => {
      prisma.membership.findMany.mockResolvedValue([])

      await repository.listByUserId('user-1')

      expect(prisma.membership.findMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } })
    })

    it('returns the memberships found for the user', async () => {
      const memberships = [makeMembership(), makeMembership({ id: 'membership-2' })]
      prisma.membership.findMany.mockResolvedValue(memberships)

      const result = await repository.listByUserId('user-1')

      expect(result).toBe(memberships)
    })
  })

  describe('isMember', () => {
    it('looks up the membership by the composite tenantId_userId key', async () => {
      prisma.membership.findUnique.mockResolvedValue(makeMembership())

      const result = await repository.isMember('user-1', 'tenant-1')

      expect(prisma.membership.findUnique).toHaveBeenCalledWith({
        where: { tenantId_userId: { tenantId: 'tenant-1', userId: 'user-1' } },
      })
      expect(result).toBe(true)
    })

    it('returns false when no membership exists', async () => {
      prisma.membership.findUnique.mockResolvedValue(null)

      const result = await repository.isMember('user-1', 'tenant-1')

      expect(result).toBe(false)
    })
  })

  describe('findByUserAndTenant', () => {
    it('looks up the membership by the composite tenantId_userId key', async () => {
      const membership = makeMembership()
      prisma.membership.findUnique.mockResolvedValue(membership)

      const result = await repository.findByUserAndTenant('user-1', 'tenant-1')

      expect(prisma.membership.findUnique).toHaveBeenCalledWith({
        where: { tenantId_userId: { tenantId: 'tenant-1', userId: 'user-1' } },
      })
      expect(result).toBe(membership)
    })

    it('returns null when no membership matches the user and tenant', async () => {
      prisma.membership.findUnique.mockResolvedValue(null)

      const result = await repository.findByUserAndTenant('user-1', 'tenant-1')

      expect(result).toBeNull()
    })
  })
})
