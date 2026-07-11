import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ReportRepository } from '../report.repository'
import type { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service'

const makePrisma = () => ({
  transaction: {
    groupBy: vi.fn(),
  },
  category: {
    findMany: vi.fn(),
  },
})

describe('ReportRepository', () => {
  let prisma: ReturnType<typeof makePrisma>
  let repository: ReportRepository

  beforeEach(() => {
    prisma = makePrisma()
    repository = new ReportRepository(prisma as unknown as PrismaService)
  })

  describe('sumExpensesByCategory', () => {
    it('aggregates in SQL filtering by expense type, non-null category and period (AC #14, #16)', async () => {
      const from = new Date('2026-01-01')
      const to = new Date('2026-01-31')
      prisma.transaction.groupBy.mockResolvedValue([])

      await repository.sumExpensesByCategory('tenant-1', from, to)

      expect(prisma.transaction.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          by: ['categoryId', 'currency'],
          where: expect.objectContaining({
            tenantId: 'tenant-1',
            type: 'expense',
            categoryId: expect.objectContaining({ not: null }),
            occurredAt: { gte: from, lte: to },
          }),
          _sum: { amountMinor: true },
        }),
      )
    })

    it('excludes null-category rows and normalizes null sums to 0 (AC #15, #18)', async () => {
      prisma.transaction.groupBy.mockResolvedValue([
        { categoryId: 'cat-1', currency: 'USD', _sum: { amountMinor: 5000 } },
        { categoryId: null, currency: 'USD', _sum: { amountMinor: 9999 } },
        { categoryId: 'cat-2', currency: 'COP', _sum: { amountMinor: null } },
      ])

      const groups = await repository.sumExpensesByCategory(
        'tenant-1',
        new Date('2026-01-01'),
        new Date('2026-01-31'),
      )

      expect(groups).toEqual([
        { categoryId: 'cat-1', currency: 'USD', totalMinor: 5000 },
        { categoryId: 'cat-2', currency: 'COP', totalMinor: 0 },
      ])
    })
  })

  describe('findCategoryNamesByIds', () => {
    it('scopes the name lookup to the tenant to prevent cross-tenant leakage (MUST-FIX 1)', async () => {
      prisma.category.findMany.mockResolvedValue([{ id: 'cat-1', name: 'Food' }])

      await repository.findCategoryNamesByIds('tenant-abc', ['cat-1'])

      expect(prisma.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-abc', id: { in: ['cat-1'] } }),
          select: { id: true, name: true },
        }),
      )
    })

    it('short-circuits without querying when no ids are requested', async () => {
      const result = await repository.findCategoryNamesByIds('tenant-1', [])

      expect(result).toEqual([])
      expect(prisma.category.findMany).not.toHaveBeenCalled()
    })
  })
})
