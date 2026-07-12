import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PrismaTransactionRepository } from '../prisma-transaction.repository'
import type { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service'

const makePrisma = () => ({
  transaction: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
    updateMany: vi.fn(),
  },
  transfer: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
})

describe('PrismaTransactionRepository', () => {
  let prisma: ReturnType<typeof makePrisma>
  let repository: PrismaTransactionRepository

  beforeEach(() => {
    prisma = makePrisma()
    repository = new PrismaTransactionRepository(prisma as unknown as PrismaService)
  })

  describe('listByTenantId', () => {
    it('excludes transactions whose account is archived', async () => {
      prisma.transaction.findMany.mockResolvedValue([])

      await repository.listByTenantId('tenant-1')

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-1', account: { archivedAt: null } },
        }),
      )
    })

    it('passes skip/take through to Prisma for pagination', async () => {
      prisma.transaction.findMany.mockResolvedValue([])

      await repository.listByTenantId('tenant-1', { skip: 20, take: 10 })

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      )
    })

    it('omits skip/take when no pagination is provided', async () => {
      prisma.transaction.findMany.mockResolvedValue([])

      await repository.listByTenantId('tenant-1')

      const call = prisma.transaction.findMany.mock.calls[0][0]
      expect(call.skip).toBeUndefined()
      expect(call.take).toBeUndefined()
    })
  })

  describe('listByAccountId', () => {
    it('excludes transactions whose account is archived (consistent with listByTenantId)', async () => {
      prisma.transaction.findMany.mockResolvedValue([])

      await repository.listByAccountId('tenant-1', 'account-1')

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-1', accountId: 'account-1', account: { archivedAt: null } },
        }),
      )
    })

    it('passes skip/take through to Prisma for pagination', async () => {
      prisma.transaction.findMany.mockResolvedValue([])

      await repository.listByAccountId('tenant-1', 'account-1', { skip: 5, take: 15 })

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 5, take: 15 }),
      )
    })
  })

  describe('countByTenantId', () => {
    it('excludes archived-account transactions from the count', async () => {
      prisma.transaction.count.mockResolvedValue(0)

      await repository.countByTenantId('tenant-1')

      expect(prisma.transaction.count).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', account: { archivedAt: null } },
      })
    })
  })

  describe('countByAccountId', () => {
    it('excludes archived-account transactions from the count (consistent with countByTenantId)', async () => {
      prisma.transaction.count.mockResolvedValue(0)

      await repository.countByAccountId('tenant-1', 'account-1')

      expect(prisma.transaction.count).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', accountId: 'account-1', account: { archivedAt: null } },
      })
    })
  })

  describe('sumByAccount', () => {
    it('groups by accountId and type, excluding archived accounts', async () => {
      prisma.transaction.groupBy.mockResolvedValue([])

      await repository.sumByAccount('tenant-1')

      expect(prisma.transaction.groupBy).toHaveBeenCalledWith({
        by: ['accountId', 'type'],
        where: { tenantId: 'tenant-1', account: { archivedAt: null } },
        _sum: { amountMinor: true },
      })
    })

    it('maps grouped income and expense rows to accountId/type/totalMinor', async () => {
      prisma.transaction.groupBy.mockResolvedValue([
        { accountId: 'account-1', type: 'income', _sum: { amountMinor: 5000 } },
        { accountId: 'account-1', type: 'expense', _sum: { amountMinor: 2000 } },
        { accountId: 'account-2', type: 'income', _sum: { amountMinor: 1500 } },
      ])

      const result = await repository.sumByAccount('tenant-1')

      expect(result).toEqual([
        { accountId: 'account-1', type: 'income', totalMinor: 5000 },
        { accountId: 'account-1', type: 'expense', totalMinor: 2000 },
        { accountId: 'account-2', type: 'income', totalMinor: 1500 },
      ])
    })

    it('normalizes a null summed amount to 0', async () => {
      prisma.transaction.groupBy.mockResolvedValue([
        { accountId: 'account-1', type: 'income', _sum: { amountMinor: null } },
      ])

      const result = await repository.sumByAccount('tenant-1')

      expect(result).toEqual([{ accountId: 'account-1', type: 'income', totalMinor: 0 }])
    })
  })
})
