import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ReportService } from '../application/report.service'
import type { ReportRepository } from '../domain/report.repository'

const makeRepository = () => ({
  sumExpensesByCategory: vi.fn(),
  findCategoryNamesByIds: vi.fn(),
})

describe('ReportService', () => {
  let repository: ReturnType<typeof makeRepository>
  let service: ReportService

  beforeEach(() => {
    repository = makeRepository()
    service = new ReportService(repository as unknown as ReportRepository)
  })

  it('keeps USD and COP as separate rows — no cross-currency summing (AC #13)', async () => {
    repository.sumExpensesByCategory.mockResolvedValue([
      { categoryId: 'cat-1', currency: 'USD', totalMinor: 10000 },
      { categoryId: 'cat-1', currency: 'COP', totalMinor: 20000000 },
    ])
    repository.findCategoryNamesByIds.mockResolvedValue([{ id: 'cat-1', name: 'Food' }])

    const result = await service.getExpensesByCategory(
      'tenant-1',
      new Date('2026-01-01'),
      new Date('2026-01-31'),
    )

    expect(result).toHaveLength(2)
    const usd = result.find((r) => r.currency === 'USD')
    const cop = result.find((r) => r.currency === 'COP')
    expect(usd?.totalMinor).toBe(10000)
    expect(cop?.totalMinor).toBe(20000000)
    expect(usd?.categoryId).toBe('cat-1')
    expect(cop?.categoryId).toBe('cat-1')
  })

  it('returns empty array when the repository reports no qualifying groups', async () => {
    repository.sumExpensesByCategory.mockResolvedValue([])

    const result = await service.getExpensesByCategory(
      'tenant-1',
      new Date('2026-01-01'),
      new Date('2026-01-31'),
    )

    expect(result).toEqual([])
    // No name lookup when there are no groups.
    expect(repository.findCategoryNamesByIds).not.toHaveBeenCalled()
  })

  it('maps category names from the repository lookup', async () => {
    repository.sumExpensesByCategory.mockResolvedValue([
      { categoryId: 'cat-1', currency: 'USD', totalMinor: 5000 },
    ])
    repository.findCategoryNamesByIds.mockResolvedValue([{ id: 'cat-1', name: 'Food' }])

    const result = await service.getExpensesByCategory(
      'tenant-1',
      new Date('2026-01-01'),
      new Date('2026-01-31'),
    )

    expect(result[0].categoryName).toBe('Food')
  })

  it('deduplicates category ids before requesting names', async () => {
    repository.sumExpensesByCategory.mockResolvedValue([
      { categoryId: 'cat-1', currency: 'USD', totalMinor: 5000 },
      { categoryId: 'cat-1', currency: 'COP', totalMinor: 30000 },
    ])
    repository.findCategoryNamesByIds.mockResolvedValue([{ id: 'cat-1', name: 'Food' }])

    await service.getExpensesByCategory('tenant-1', new Date('2026-01-01'), new Date('2026-01-31'))

    expect(repository.findCategoryNamesByIds).toHaveBeenCalledWith('tenant-1', ['cat-1'])
  })

  it('falls back to "Unknown" when a category name is not found', async () => {
    repository.sumExpensesByCategory.mockResolvedValue([
      { categoryId: 'cat-ghost', currency: 'USD', totalMinor: 1000 },
    ])
    repository.findCategoryNamesByIds.mockResolvedValue([])

    const result = await service.getExpensesByCategory(
      'tenant-1',
      new Date('2026-01-01'),
      new Date('2026-01-31'),
    )

    expect(result[0].categoryName).toBe('Unknown')
  })

  it('propagates integer totals from the repository (AC #18)', async () => {
    repository.sumExpensesByCategory.mockResolvedValue([
      { categoryId: 'cat-1', currency: 'USD', totalMinor: 0 },
    ])
    repository.findCategoryNamesByIds.mockResolvedValue([{ id: 'cat-1', name: 'Food' }])

    const result = await service.getExpensesByCategory(
      'tenant-1',
      new Date('2026-01-01'),
      new Date('2026-01-31'),
    )

    expect(result[0].totalMinor).toBe(0)
    expect(Number.isInteger(result[0].totalMinor)).toBe(true)
  })
})
