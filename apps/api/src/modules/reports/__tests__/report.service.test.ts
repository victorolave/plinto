import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ReportService } from '../application/report.service'

const makePrisma = () => ({
  transaction: {
    groupBy: vi.fn(),
    findMany: vi.fn(),
  },
  category: {
    findMany: vi.fn(),
  },
})

describe('ReportService', () => {
  let prisma: ReturnType<typeof makePrisma>
  let service: ReportService

  beforeEach(() => {
    prisma = makePrisma()
    service = new ReportService(prisma as any)
  })

  it('returns USD and COP as separate rows — no cross-currency summing (AC #13)', async () => {
    const from = new Date('2026-01-01')
    const to = new Date('2026-01-31')

    prisma.transaction.groupBy.mockResolvedValue([
      { categoryId: 'cat-1', currency: 'USD', _sum: { amountMinor: 10000 } },
      { categoryId: 'cat-1', currency: 'COP', _sum: { amountMinor: 20000000 } },
    ])
    prisma.category.findMany.mockResolvedValue([{ id: 'cat-1', name: 'Food' }])

    const result = await service.getExpensesByCategory('tenant-1', from, to)

    expect(result).toHaveLength(2)
    const usd = result.find((r) => r.currency === 'USD')
    const cop = result.find((r) => r.currency === 'COP')
    expect(usd?.totalMinor).toBe(10000)
    expect(cop?.totalMinor).toBe(20000000)
    expect(usd?.categoryId).toBe('cat-1')
    expect(cop?.categoryId).toBe('cat-1')
  })

  it('excludes income transactions from the report (AC #14)', async () => {
    // groupBy query filters on type='expense' — mock returns empty to simulate income excluded
    prisma.transaction.groupBy.mockResolvedValue([])
    prisma.category.findMany.mockResolvedValue([])

    const result = await service.getExpensesByCategory(
      'tenant-1',
      new Date('2026-01-01'),
      new Date('2026-01-31'),
    )

    expect(prisma.transaction.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: 'expense' }),
      }),
    )
    expect(result).toEqual([])
  })

  it('excludes null categoryId rows from the report (AC #15)', async () => {
    prisma.transaction.groupBy.mockResolvedValue([])
    prisma.category.findMany.mockResolvedValue([])

    await service.getExpensesByCategory(
      'tenant-1',
      new Date('2026-01-01'),
      new Date('2026-01-31'),
    )

    expect(prisma.transaction.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          categoryId: expect.objectContaining({ not: null }),
        }),
      }),
    )
  })

  it('filters by occurredAt period (AC #16)', async () => {
    const from = new Date('2026-01-01')
    const to = new Date('2026-01-31')
    prisma.transaction.groupBy.mockResolvedValue([])
    prisma.category.findMany.mockResolvedValue([])

    await service.getExpensesByCategory('tenant-1', from, to)

    expect(prisma.transaction.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          occurredAt: { gte: from, lte: to },
        }),
      }),
    )
  })

  it('maps category names via a second findMany query', async () => {
    prisma.transaction.groupBy.mockResolvedValue([
      { categoryId: 'cat-1', currency: 'USD', _sum: { amountMinor: 5000 } },
    ])
    prisma.category.findMany.mockResolvedValue([{ id: 'cat-1', name: 'Food' }])

    const result = await service.getExpensesByCategory(
      'tenant-1',
      new Date('2026-01-01'),
      new Date('2026-01-31'),
    )

    expect(result[0].categoryName).toBe('Food')
  })

  it('guards missing category name — uses "Unknown" when name is not found', async () => {
    prisma.transaction.groupBy.mockResolvedValue([
      { categoryId: 'cat-ghost', currency: 'USD', _sum: { amountMinor: 1000 } },
    ])
    // category was deleted or join failed — findMany returns nothing for that id
    prisma.category.findMany.mockResolvedValue([])

    const result = await service.getExpensesByCategory(
      'tenant-1',
      new Date('2026-01-01'),
      new Date('2026-01-31'),
    )

    expect(result[0].categoryName).toBe('Unknown')
  })

  it('totalMinor is an integer — uses 0 when _sum.amountMinor is null (AC #18)', async () => {
    prisma.transaction.groupBy.mockResolvedValue([
      { categoryId: 'cat-1', currency: 'USD', _sum: { amountMinor: null } },
    ])
    prisma.category.findMany.mockResolvedValue([{ id: 'cat-1', name: 'Food' }])

    const result = await service.getExpensesByCategory(
      'tenant-1',
      new Date('2026-01-01'),
      new Date('2026-01-31'),
    )

    expect(result[0].totalMinor).toBe(0)
    expect(Number.isInteger(result[0].totalMinor)).toBe(true)
  })

  it('returns empty array when no qualifying transactions exist', async () => {
    prisma.transaction.groupBy.mockResolvedValue([])
    prisma.category.findMany.mockResolvedValue([])

    const result = await service.getExpensesByCategory(
      'tenant-1',
      new Date('2026-01-01'),
      new Date('2026-01-31'),
    )

    expect(result).toEqual([])
  })

  // FIX 1: category name-join must be scoped to tenantId to prevent cross-tenant name leakage
  it('scopes the category name-join findMany to the same tenantId (MUST-FIX 1)', async () => {
    prisma.transaction.groupBy.mockResolvedValue([
      { categoryId: 'cat-1', currency: 'USD', _sum: { amountMinor: 5000 } },
    ])
    prisma.category.findMany.mockResolvedValue([{ id: 'cat-1', name: 'Food' }])

    await service.getExpensesByCategory('tenant-abc', new Date('2026-01-01'), new Date('2026-01-31'))

    expect(prisma.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-abc' }),
      }),
    )
  })
})
