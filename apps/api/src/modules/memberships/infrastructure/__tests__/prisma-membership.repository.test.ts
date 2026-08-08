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

  describe('listMembersByTenantId', () => {
    const makeMembershipWithUser = (overrides = {}) => ({
      ...makeMembership(),
      user: { id: 'user-1', email: 'victor@example.com', name: 'Victor' },
      ...overrides,
    })

    it('scopes the listing to the tenant and joins the identity behind each membership', async () => {
      prisma.membership.findMany.mockResolvedValue([])

      await repository.listMembersByTenantId('tenant-1')

      expect(prisma.membership.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' },
        include: { user: { select: { id: true, email: true, name: true } } },
        orderBy: [{ createdAt: 'asc' }, { user: { email: 'asc' } }],
      })
    })

    it('maps rows onto the member shape, dropping the membership id', async () => {
      const joinedAt = new Date('2026-01-01T00:00:00.000Z')
      prisma.membership.findMany.mockResolvedValue([
        makeMembershipWithUser({ role: 'owner', createdAt: joinedAt }),
      ])

      const result = await repository.listMembersByTenantId('tenant-1')

      expect(result).toEqual([
        {
          userId: 'user-1',
          email: 'victor@example.com',
          name: 'Victor',
          role: 'owner',
          joinedAt,
        },
      ])
      expect(result[0]).not.toHaveProperty('id')
      expect(result[0]).not.toHaveProperty('tenantId')
    })

    it('preserves a null name, which the IdP may not have supplied', async () => {
      prisma.membership.findMany.mockResolvedValue([
        makeMembershipWithUser({
          user: { id: 'user-2', email: 'sandra@example.com', name: null },
        }),
      ])

      const result = await repository.listMembersByTenantId('tenant-1')

      expect(result[0].name).toBeNull()
      expect(result[0].email).toBe('sandra@example.com')
    })

    it('returns an empty list rather than throwing for a tenant with no rows', async () => {
      prisma.membership.findMany.mockResolvedValue([])

      await expect(repository.listMembersByTenantId('tenant-1')).resolves.toEqual([])
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
