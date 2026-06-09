import { describe, it, expect } from 'vitest'
import { ErrorSchema, ErrorResponseSchema } from '../error.schema'

describe('ErrorSchema', () => {
  const validError = {
    code: 'NOT_FOUND',
    message: 'Resource not found',
  }

  it('parses a valid error with required fields only', () => {
    const result = ErrorSchema.safeParse(validError)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.code).toBe('NOT_FOUND')
      expect(result.data.details).toBeUndefined()
      expect(result.data.traceId).toBeUndefined()
    }
  })

  it('parses a valid error with all optional fields', () => {
    const result = ErrorSchema.safeParse({
      ...validError,
      details: ['field is required'],
      traceId: 'trace-abc',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.details).toEqual(['field is required'])
      expect(result.data.traceId).toBe('trace-abc')
    }
  })

  it('parses details as array of unknown (mixed types)', () => {
    const result = ErrorSchema.safeParse({
      ...validError,
      details: [{ field: 'email' }, 'some string', 42],
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing code', () => {
    const { code: _c, ...rest } = validError
    const result = ErrorSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects missing message', () => {
    const { message: _m, ...rest } = validError
    const result = ErrorSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })
})

describe('ErrorResponseSchema', () => {
  it('parses a valid error response envelope', () => {
    const result = ErrorResponseSchema.safeParse({
      error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.error.code).toBe('UNAUTHORIZED')
    }
  })

  it('rejects when error field is missing', () => {
    const result = ErrorResponseSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('rejects when error is not an object', () => {
    const result = ErrorResponseSchema.safeParse({ error: 'plain string' })
    expect(result.success).toBe(false)
  })
})
