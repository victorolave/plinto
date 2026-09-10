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

  /**
   * `list` and `count` replaced four near-identical methods that each repeated
   * the archived-account clause. They share one `where` builder now, so a
   * filter added to the list can never drift from the total reported beside it.
   */
  describe('list', () => {
    it('excludes transactions whose account is archived', async () => {
      prisma.transaction.findMany.mockResolvedValue([])

      await repository.list('tenant-1', {})

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-1', account: { archivedAt: null } },
        }),
      )
    })

    it('passes skip/take through to Prisma for pagination', async () => {
      prisma.transaction.findMany.mockResolvedValue([])

      await repository.list('tenant-1', {}, { skip: 20, take: 10 })

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      )
    })

    it('omits skip/take when no pagination is provided', async () => {
      prisma.transaction.findMany.mockResolvedValue([])

      await repository.list('tenant-1', {})

      const call = prisma.transaction.findMany.mock.calls[0][0]
      expect(call.skip).toBeUndefined()
      expect(call.take).toBeUndefined()
    })

    it('narrows to one account, still excluding archived ones', async () => {
      prisma.transaction.findMany.mockResolvedValue([])

      await repository.list('tenant-1', { accountId: 'account-1' })

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-1',
            account: { archivedAt: null },
            accountId: 'account-1',
          },
        }),
      )
    })

    it('narrows to a movement type', async () => {
      prisma.transaction.findMany.mockResolvedValue([])

      await repository.list('tenant-1', { type: 'expense' })

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'expense' }),
        }),
      )
    })

    /**
     * The browser filter compared `occurredAt.slice(0, 10)` — the UTC date —
     * so the day boundaries here are UTC too. Anchoring them to the server's
     * zone instead would quietly drop or add a day's rows.
     */
    it('bounds a date range by whole UTC days, inclusive at both ends', async () => {
      prisma.transaction.findMany.mockResolvedValue([])

      await repository.list('tenant-1', { dateFrom: '2026-01-01', dateTo: '2026-01-31' })

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            occurredAt: {
              gte: new Date('2026-01-01T00:00:00.000Z'),
              lte: new Date('2026-01-31T23:59:59.999Z'),
            },
          }),
        }),
      )
    })

    it('accepts an open-ended range', async () => {
      prisma.transaction.findMany.mockResolvedValue([])

      await repository.list('tenant-1', { dateFrom: '2026-01-01' })

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            occurredAt: { gte: new Date('2026-01-01T00:00:00.000Z') },
          }),
        }),
      )
    })

    /**
     * The browser searched description *and* account name, so the server has
     * to as well — otherwise the same term would return fewer rows than it did
     * before the list was paginated.
     */
    it('searches the description and the account name, case-insensitively', async () => {
      prisma.transaction.findMany.mockResolvedValue([])

      await repository.list('tenant-1', { search: 'mercado' })

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { description: { contains: 'mercado', mode: 'insensitive' } },
              { account: { name: { contains: 'mercado', mode: 'insensitive' } } },
            ],
          }),
        }),
      )
    })

    it('leaves the where clause bare when nothing is filtered', async () => {
      prisma.transaction.findMany.mockResolvedValue([])

      await repository.list('tenant-1', {})

      const { where } = prisma.transaction.findMany.mock.calls[0][0]
      expect(where.type).toBeUndefined()
      expect(where.occurredAt).toBeUndefined()
      expect(where.OR).toBeUndefined()
      expect(where.accountId).toBeUndefined()
    })

    it('orders newest first', async () => {
      prisma.transaction.findMany.mockResolvedValue([])

      await repository.list('tenant-1', {})

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
        }),
      )
    })
  })

  describe('countByType', () => {
    it('excludes archived-account transactions from the counts', async () => {
      prisma.transaction.groupBy.mockResolvedValue([])

      await repository.countByType('tenant-1', {})

      expect(prisma.transaction.groupBy).toHaveBeenCalledWith({
        by: ['type'],
        where: { tenantId: 'tenant-1', account: { archivedAt: null } },
        _count: { _all: true },
      })
    })

    /**
     * The counts label the income/expense tabs, and the tabs are what sets the
     * type filter. Counting *through* that filter would answer "how many
     * expenses are there, among the expenses" and report zero for income.
     */
    it('counts through every filter except the type it is splitting by', async () => {
      prisma.transaction.groupBy.mockResolvedValue([])

      await repository.countByType('tenant-1', { accountId: 'account-1', search: 'mercado' })

      expect(prisma.transaction.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            accountId: 'account-1',
            OR: [
              { description: { contains: 'mercado', mode: 'insensitive' } },
              { account: { name: { contains: 'mercado', mode: 'insensitive' } } },
            ],
          }),
        }),
      )
    })

    it('reports zero for a type with no rows rather than omitting it', async () => {
      prisma.transaction.groupBy.mockResolvedValue([
        { type: 'expense', _count: { _all: 7 } },
      ])

      const counts = await repository.countByType('tenant-1', {})

      expect(counts).toEqual({ income: 0, expense: 7 })
    })

    it('maps both grouped rows', async () => {
      prisma.transaction.groupBy.mockResolvedValue([
        { type: 'income', _count: { _all: 3 } },
        { type: 'expense', _count: { _all: 9 } },
      ])

      const counts = await repository.countByType('tenant-1', {})

      expect(counts).toEqual({ income: 3, expense: 9 })
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
