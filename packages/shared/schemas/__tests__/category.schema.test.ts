import { describe, it, expect } from 'vitest'
import {
  CategorySchema,
  CreateCategorySchema,
  UpdateCategorySchema,
  ExpenseByCategoryItemSchema,
  ExpenseByCategoryReportSchema,
} from '../category.schema'

describe('CreateCategorySchema', () => {
  it('parses a valid create payload with all fields', () => {
    const result = CreateCategorySchema.safeParse({
      name: 'Food',
      type: 'expense',
      color: '#FF0000',
    })
    expect(result.success).toBe(true)
  })

  it('parses a valid create payload without color', () => {
    const result = CreateCategorySchema.safeParse({
      name: 'Salary',
      type: 'income',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.color).toBeUndefined()
    }
  })

  it('rejects empty name', () => {
    const result = CreateCategorySchema.safeParse({
      name: '',
      type: 'expense',
    })
    expect(result.success).toBe(false)
  })

  it('rejects whitespace-only name', () => {
    const result = CreateCategorySchema.safeParse({
      name: '   ',
      type: 'expense',
    })
    expect(result.success).toBe(false)
  })

  it('trims color when present', () => {
    const result = CreateCategorySchema.safeParse({
      name: 'Food',
      type: 'expense',
      color: '  #FF0000  ',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.color).toBe('#FF0000')
    }
  })

  it('rejects invalid type', () => {
    const result = CreateCategorySchema.safeParse({
      name: 'Food',
      type: 'transfer',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing type', () => {
    const result = CreateCategorySchema.safeParse({
      name: 'Food',
    })
    expect(result.success).toBe(false)
  })
})

describe('UpdateCategorySchema', () => {
  it('parses a valid update with name only', () => {
    const result = UpdateCategorySchema.safeParse({ name: 'Groceries' })
    expect(result.success).toBe(true)
  })

  it('parses a valid update with color set to null (clear color)', () => {
    const result = UpdateCategorySchema.safeParse({ color: null })
    expect(result.success).toBe(true)
  })

  it('parses a valid update with both name and color', () => {
    const result = UpdateCategorySchema.safeParse({
      name: 'Groceries',
      color: '#00FF00',
    })
    expect(result.success).toBe(true)
  })

  it('rejects an empty payload (refine: at least one field)', () => {
    const result = UpdateCategorySchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('rejects payload with only undefined values', () => {
    const result = UpdateCategorySchema.safeParse({ name: undefined, color: undefined })
    expect(result.success).toBe(false)
  })

  it('rejects whitespace-only name', () => {
    const result = UpdateCategorySchema.safeParse({ name: '  ' })
    expect(result.success).toBe(false)
  })
})

describe('CategorySchema', () => {
  const validCategory = {
    id: 'cat-1',
    tenantId: 'tenant-1',
    name: 'Food',
    type: 'expense',
    color: '#FF0000',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }

  it('parses a valid category with color', () => {
    const result = CategorySchema.safeParse(validCategory)
    expect(result.success).toBe(true)
  })

  it('parses a valid category with color as null', () => {
    const result = CategorySchema.safeParse({ ...validCategory, color: null })
    expect(result.success).toBe(true)
  })

  it('rejects missing id', () => {
    const { id: _id, ...rest } = validCategory
    const result = CategorySchema.safeParse(rest)
    expect(result.success).toBe(false)
  })
})

describe('ExpenseByCategoryItemSchema', () => {
  it('parses a valid report item', () => {
    const result = ExpenseByCategoryItemSchema.safeParse({
      categoryId: 'cat-1',
      categoryName: 'Food',
      currency: 'USD',
      totalMinor: 5000,
    })
    expect(result.success).toBe(true)
  })

  it('rejects non-integer totalMinor', () => {
    const result = ExpenseByCategoryItemSchema.safeParse({
      categoryId: 'cat-1',
      categoryName: 'Food',
      currency: 'USD',
      totalMinor: 50.5,
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid currency format', () => {
    const result = ExpenseByCategoryItemSchema.safeParse({
      categoryId: 'cat-1',
      categoryName: 'Food',
      currency: 'usd',
      totalMinor: 5000,
    })
    expect(result.success).toBe(false)
  })
})

describe('ExpenseByCategoryReportSchema', () => {
  it('parses a valid report with items', () => {
    const result = ExpenseByCategoryReportSchema.safeParse({
      from: '2026-01-01',
      to: '2026-01-31',
      items: [
        {
          categoryId: 'cat-1',
          categoryName: 'Food',
          currency: 'USD',
          totalMinor: 5000,
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('parses a report with empty items array', () => {
    const result = ExpenseByCategoryReportSchema.safeParse({
      from: '2026-01-01',
      to: '2026-01-31',
      items: [],
    })
    expect(result.success).toBe(true)
  })
})
