import { describe, it, expect } from 'vitest'
import { BadRequestException } from '@nestjs/common'
import { IdempotencyKeyPipe } from '../idempotency-key.pipe'

describe('IdempotencyKeyPipe', () => {
  it('passes an absent header through as undefined', () => {
    const pipe = new IdempotencyKeyPipe()

    expect(pipe.transform(undefined)).toBeUndefined()
  })

  it('trims a header value', () => {
    const pipe = new IdempotencyKeyPipe()

    expect(pipe.transform('  retry-1  ')).toBe('retry-1')
  })

  it('takes the first value when the header repeated', () => {
    const pipe = new IdempotencyKeyPipe()

    expect(pipe.transform(['retry-1', 'retry-2'])).toBe('retry-1')
  })

  it('rejects a blank header with the standard VALIDATION_ERROR shape', () => {
    const pipe = new IdempotencyKeyPipe()

    try {
      pipe.transform('   ')
      expect.unreachable('expected transform to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException)
      expect((error as BadRequestException).getResponse()).toMatchObject({
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
      })
    }
  })

  it('rejects a header over 200 characters', () => {
    const pipe = new IdempotencyKeyPipe()
    const tooLong = 'a'.repeat(201)

    expect(() => pipe.transform(tooLong)).toThrow(BadRequestException)
  })

  it('accepts a header at exactly 200 characters', () => {
    const pipe = new IdempotencyKeyPipe()
    const atLimit = 'a'.repeat(200)

    expect(pipe.transform(atLimit)).toBe(atLimit)
  })
})
