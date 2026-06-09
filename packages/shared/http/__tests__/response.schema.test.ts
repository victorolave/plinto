import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { dataResponseSchema } from '../response.schema'

describe('dataResponseSchema', () => {
  it('wraps a string schema and parses a valid response', () => {
    const Schema = dataResponseSchema(z.string())
    const result = Schema.safeParse({ data: 'hello' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.data).toBe('hello')
    }
  })

  it('wraps an object schema and parses correctly', () => {
    const Schema = dataResponseSchema(z.object({ id: z.string() }))
    const result = Schema.safeParse({ data: { id: '123' } })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.data.id).toBe('123')
    }
  })

  it('wraps an array schema and parses correctly', () => {
    const Schema = dataResponseSchema(z.array(z.number()))
    const result = Schema.safeParse({ data: [1, 2, 3] })
    expect(result.success).toBe(true)
  })

  it('rejects when data field is missing', () => {
    const Schema = dataResponseSchema(z.string())
    const result = Schema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('rejects when data does not match inner schema', () => {
    const Schema = dataResponseSchema(z.number())
    const result = Schema.safeParse({ data: 'not a number' })
    expect(result.success).toBe(false)
  })
})
