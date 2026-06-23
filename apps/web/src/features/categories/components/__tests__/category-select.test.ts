import { describe, expect, it } from 'vitest'
import { filterCategoriesByType } from '../category-select'
import type { Category } from '../../services/categories'

describe('CategorySelect pure helpers', () => {
  const categories: Category[] = [
    { id: 'cat-1', tenantId: 't-1', name: 'Food', type: 'expense', color: null, createdAt: '', updatedAt: '' },
    { id: 'cat-2', tenantId: 't-1', name: 'Salary', type: 'income', color: null, createdAt: '', updatedAt: '' },
    { id: 'cat-3', tenantId: 't-1', name: 'Transport', type: 'expense', color: '#0000FF', createdAt: '', updatedAt: '' },
  ]

  it('returns only categories matching the given type', () => {
    const result = filterCategoriesByType(categories, 'expense')
    expect(result).toHaveLength(2)
    expect(result.map((c) => c.id)).toEqual(['cat-1', 'cat-3'])
  })

  it('returns income categories when type is income', () => {
    const result = filterCategoriesByType(categories, 'income')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('cat-2')
  })

  it('returns empty array when no categories match the type', () => {
    const result = filterCategoriesByType([], 'expense')
    expect(result).toHaveLength(0)
  })

  it('returns empty array when category list is empty', () => {
    const result = filterCategoriesByType([], 'income')
    expect(result).toHaveLength(0)
  })
})
