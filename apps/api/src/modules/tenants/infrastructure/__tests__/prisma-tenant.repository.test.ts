import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PrismaTenantRepository } from '../prisma-tenant.repository'
import type { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service'

const makePrisma = () => ({
  tenant: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
  membership: {
    findMany: vi.fn(),
  },
})

const makeTenant = (overrides = {}) => ({
  id: 'tenant-1',
  name: 'Acme Inc',
  baseCurrency: 'USD',
  isDemo: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

describe('PrismaTenantRepository', () => {
  let prisma: ReturnType<typeof makePrisma>
  let repository: PrismaTenantRepository

  beforeEach(() => {
    prisma = makePrisma()
    repository = new PrismaTenantRepository(prisma as unknown as PrismaService)
  })

  describe('create', () => {
    it('creates the tenant with the given name and base currency', async () => {
      const tenant = makeTenant()
      prisma.tenant.create.mockResolvedValue(tenant)

      const result = await repository.create({ name: 'Acme Inc', baseCurrency: 'USD' })

      expect(prisma.tenant.create).toHaveBeenCalledWith({
        data: { name: 'Acme Inc', baseCurrency: 'USD' },
      })
      expect(result).toBe(tenant)
    })
  })

  describe('findById', () => {
    it('looks up the tenant by id', async () => {
      const tenant = makeTenant()
      prisma.tenant.findUnique.mockResolvedValue(tenant)

      const result = await repository.findById('tenant-1')

      expect(prisma.tenant.findUnique).toHaveBeenCalledWith({ where: { id: 'tenant-1' } })
      expect(result).toBe(tenant)
    })

    it('returns null when no tenant matches the id', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null)

      const result = await repository.findById('missing-tenant')

      expect(result).toBeNull()
    })
  })

  describe('listByUserId', () => {
    it('looks up memberships for the user and includes the related tenant', async () => {
      prisma.membership.findMany.mockResolvedValue([])

      await repository.listByUserId('user-1')

      expect(prisma.membership.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        include: { tenant: true },
      })
    })

    it('maps memberships to their related tenant, preserving order', async () => {
      const tenantA = makeTenant({ id: 'tenant-a' })
      const tenantB = makeTenant({ id: 'tenant-b' })
      prisma.membership.findMany.mockResolvedValue([
        { id: 'm-1', userId: 'user-1', tenantId: 'tenant-a', tenant: tenantA },
        { id: 'm-2', userId: 'user-1', tenantId: 'tenant-b', tenant: tenantB },
      ])

      const result = await repository.listByUserId('user-1')

      expect(result).toEqual([tenantA, tenantB])
    })

    it('returns an empty array when the user has no memberships', async () => {
      prisma.membership.findMany.mockResolvedValue([])

      const result = await repository.listByUserId('user-1')

      expect(result).toEqual([])
    })
  })

  describe('findDemoTenantForOwner', () => {
    it('looks up an isDemo tenant owned by the user', async () => {
      const tenant = makeTenant({ isDemo: true })
      prisma.tenant.findFirst.mockResolvedValue(tenant)

      const result = await repository.findDemoTenantForOwner('user-1')

      expect(prisma.tenant.findFirst).toHaveBeenCalledWith({
        where: { isDemo: true, memberships: { some: { userId: 'user-1', role: 'owner' } } },
      })
      expect(result).toBe(tenant)
    })

    it('returns null when the user owns no demo tenant', async () => {
      prisma.tenant.findFirst.mockResolvedValue(null)

      const result = await repository.findDemoTenantForOwner('user-1')

      expect(result).toBeNull()
    })
  })
})
