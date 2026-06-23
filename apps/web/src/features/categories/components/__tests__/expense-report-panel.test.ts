import { describe, expect, it } from 'vitest'
import { groupReportItemsByCurrency, formatMinorAmount } from '../expense-report-panel'
import type { ExpenseReportItem } from '../../services/categories'

describe('ExpenseReportPanel pure helpers', () => {
  const items: ExpenseReportItem[] = [
    { categoryId: 'cat-1', categoryName: 'Food', currency: 'USD', totalMinor: 10000 },
    { categoryId: 'cat-1', categoryName: 'Food', currency: 'COP', totalMinor: 200000 },
    { categoryId: 'cat-2', categoryName: 'Transport', currency: 'USD', totalMinor: 5000 },
  ]

  it('groups report items by currency without merging cross-currency totals', () => {
    const grouped = groupReportItemsByCurrency(items)
    expect(Object.keys(grouped).sort()).toEqual(['COP', 'USD'])
    expect(grouped['USD']).toHaveLength(2)
    expect(grouped['COP']).toHaveLength(1)
  })

  it('never combines USD and COP rows into a single entry', () => {
    const grouped = groupReportItemsByCurrency(items)
    // USD and COP must be separate groups — no merged row
    expect(grouped['USD']).not.toEqual(grouped['COP'])
    expect(grouped['USD'].every((item) => item.currency === 'USD')).toBe(true)
    expect(grouped['COP'].every((item) => item.currency === 'COP')).toBe(true)
  })

  it('returns empty object for empty items array', () => {
    const grouped = groupReportItemsByCurrency([])
    expect(grouped).toEqual({})
  })

  it('formats minor amount as major unit string with two decimal places', () => {
    expect(formatMinorAmount(10000)).toBe('100.00')
    expect(formatMinorAmount(1050)).toBe('10.50')
    expect(formatMinorAmount(0)).toBe('0.00')
  })
})
