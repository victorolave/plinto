import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PrismaAccountRepository } from '../prisma-account.repository'
import type { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service'

const makePrisma = () => ({
  account: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
})

const makeAccount = (overrides = {}) => ({
  id: 'account-1',
  tenantId: 'tenant-1',
  name: 'Main checking',
  type: 'bank' as const,
  currency: 'USD',
  createdAt: new Date(),
  updatedAt: new Date(),
  archivedAt: null,
  ...overrides,
})

describe('PrismaAccountRepository', () => {
  let prisma: ReturnType<typeof makePrisma>
  let repository: PrismaAccountRepository

  beforeEach(() => {
    prisma = makePrisma()
    repository = new PrismaAccountRepository(prisma as unknown as PrismaService)
  })

  describe('create', () => {
    it('creates the account with the given tenant, name, type, and currency', async () => {
      const account = makeAccount()
      prisma.account.create.mockResolvedValue(account)

      const result = await repository.create({
        tenantId: 'tenant-1',
        name: 'Main checking',
        type: 'bank',
        currency: 'USD',
      })

      expect(prisma.account.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-1',
          name: 'Main checking',
          type: 'bank',
          currency: 'USD',
        },
      })
      expect(result).toBe(account)
    })
  })

  describe('listByTenantId', () => {
    it('excludes archived accounts by default', async () => {
      prisma.account.findMany.mockResolvedValue([])

      await repository.listByTenantId('tenant-1')

      expect(prisma.account.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', archivedAt: null },
        orderBy: { createdAt: 'asc' },
      })
    })

    it('excludes archived accounts when includeArchived is explicitly false', async () => {
      prisma.account.findMany.mockResolvedValue([])

      await repository.listByTenantId('tenant-1', { includeArchived: false })

      expect(prisma.account.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', archivedAt: null },
        orderBy: { createdAt: 'asc' },
      })
    })

    it('includes archived accounts when includeArchived is true', async () => {
      prisma.account.findMany.mockResolvedValue([])

      await repository.listByTenantId('tenant-1', { includeArchived: true })

      expect(prisma.account.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' },
        orderBy: { createdAt: 'asc' },
      })
    })
  })

  describe('findByIdForTenant', () => {
    it('scopes the lookup by id and tenantId', async () => {
      const account = makeAccount()
      prisma.account.findFirst.mockResolvedValue(account)

      const result = await repository.findByIdForTenant('account-1', 'tenant-1')

      expect(prisma.account.findFirst).toHaveBeenCalledWith({
        where: { id: 'account-1', tenantId: 'tenant-1' },
      })
      expect(result).toBe(account)
    })

    it('returns null when no account matches the tenant', async () => {
      prisma.account.findFirst.mockResolvedValue(null)

      const result = await repository.findByIdForTenant('account-1', 'wrong-tenant')

      expect(result).toBeNull()
    })
  })

  describe('updateForTenant', () => {
    it('updates only rows matching id and tenantId, then re-reads', async () => {
      const account = makeAccount({ name: 'Renamed' })
      prisma.account.updateMany.mockResolvedValue({ count: 1 })
      prisma.account.findFirst.mockResolvedValue(account)

      const result = await repository.updateForTenant('account-1', 'tenant-1', {
        name: 'Renamed',
      })

      expect(prisma.account.updateMany).toHaveBeenCalledWith({
        where: { id: 'account-1', tenantId: 'tenant-1' },
        data: { name: 'Renamed' },
      })
      expect(prisma.account.findFirst).toHaveBeenCalledWith({
        where: { id: 'account-1', tenantId: 'tenant-1' },
      })
      expect(result).toBe(account)
    })

    it('returns null and skips the re-read when no row was updated (count === 0)', async () => {
      prisma.account.updateMany.mockResolvedValue({ count: 0 })

      const result = await repository.updateForTenant('account-1', 'wrong-tenant', {
        name: 'Renamed',
      })

      expect(result).toBeNull()
      expect(prisma.account.findFirst).not.toHaveBeenCalled()
    })
  })

  describe('archiveForTenant', () => {
    it('only archives rows that are id/tenant matched and not already archived', async () => {
      const archivedAt = new Date('2026-07-01T00:00:00.000Z')
      const account = makeAccount({ archivedAt })
      prisma.account.updateMany.mockResolvedValue({ count: 1 })
      prisma.account.findFirst.mockResolvedValue(account)

      const result = await repository.archiveForTenant('account-1', 'tenant-1', archivedAt)

      expect(prisma.account.updateMany).toHaveBeenCalledWith({
        where: { id: 'account-1', tenantId: 'tenant-1', archivedAt: null },
        data: { archivedAt },
      })
      expect(result).toBe(account)
    })

    it('returns null without re-reading when the account is already archived (count === 0)', async () => {
      prisma.account.updateMany.mockResolvedValue({ count: 0 })

      const result = await repository.archiveForTenant(
        'account-1',
        'tenant-1',
        new Date('2026-07-01T00:00:00.000Z'),
      )

      expect(result).toBeNull()
      expect(prisma.account.findFirst).not.toHaveBeenCalled()
    })
  })

  describe('restoreForTenant', () => {
    it('only restores rows that are id/tenant matched and currently archived', async () => {
      const account = makeAccount({ archivedAt: null })
      prisma.account.updateMany.mockResolvedValue({ count: 1 })
      prisma.account.findFirst.mockResolvedValue(account)

      const result = await repository.restoreForTenant('account-1', 'tenant-1')

      expect(prisma.account.updateMany).toHaveBeenCalledWith({
        where: { id: 'account-1', tenantId: 'tenant-1', archivedAt: { not: null } },
        data: { archivedAt: null },
      })
      expect(result).toBe(account)
    })

    it('returns null without re-reading when the account is not archived (count === 0)', async () => {
      prisma.account.updateMany.mockResolvedValue({ count: 0 })

      const result = await repository.restoreForTenant('account-1', 'tenant-1')

      expect(result).toBeNull()
      expect(prisma.account.findFirst).not.toHaveBeenCalled()
    })
  })
})
