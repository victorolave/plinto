import { describe, it, expect } from 'vitest'
import { PaginationQuerySchema, PaginationMetaSchema } from '../pagination.schema'

describe('PaginationQuerySchema', () => {
  it('defaults page to 1 and pageSize to 50 when omitted', () => {
    const result = PaginationQuerySchema.parse({})
    expect(result).toEqual({ page: 1, pageSize: 50 })
  })

  it('coerces string query params to numbers', () => {
    const result = PaginationQuerySchema.parse({ page: '2', pageSize: '25' })
    expect(result).toEqual({ page: 2, pageSize: 25 })
  })

  it('rejects a page below 1', () => {
    const result = PaginationQuerySchema.safeParse({ page: 0 })
    expect(result.success).toBe(false)
  })

  it('rejects a pageSize above 100', () => {
    const result = PaginationQuerySchema.safeParse({ pageSize: 101 })
    expect(result.success).toBe(false)
  })

  it('rejects a non-integer page', () => {
    const result = PaginationQuerySchema.safeParse({ page: 1.5 })
    expect(result.success).toBe(false)
  })
})

describe('PaginationMetaSchema', () => {
  it('parses a valid pagination meta object', () => {
    const result = PaginationMetaSchema.safeParse({
      page: 1,
      pageSize: 50,
      total: 120,
      totalPages: 3,
    })
    expect(result.success).toBe(true)
  })
})
