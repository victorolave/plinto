import { describe, it, expect } from 'vitest'
import { ArgumentMetadata, BadRequestException } from '@nestjs/common'
import { z } from 'zod'
import { ZodValidationPipe } from '../zod-validation.pipe'

const schema = z.object({ name: z.string().min(1) })

const meta = (type: ArgumentMetadata['type']): ArgumentMetadata => ({
  type,
  metatype: undefined,
  data: undefined,
})

describe('ZodValidationPipe', () => {
  it('parses a valid body and returns the parsed value', () => {
    const pipe = new ZodValidationPipe(schema)

    expect(pipe.transform({ name: 'ADDI' }, meta('body'))).toEqual({ name: 'ADDI' })
  })

  it('raises a typed VALIDATION_ERROR on an invalid body', () => {
    const pipe = new ZodValidationPipe(schema)

    expect(() => pipe.transform({ name: '' }, meta('body'))).toThrow(BadRequestException)
  })

  /**
   * The regression this pipe exists to prevent.
   *
   * Nest runs a method-scoped pipe against every argument of the handler, so on
   * `PATCH /:id` the pipe also receives the path parameter. Validating it
   * against a body schema rejected the request with
   * `Expected object, received string` before the body was ever read — and the
   * message named the schema rather than the parameter, so it read like a
   * client mistake. `PATCH /credit-lines/:id`, `PATCH /debts/:id` and
   * `PATCH /members/:userId` were all broken this way.
   */
  it.each(['param', 'query', 'custom'] as const)(
    'passes a %s argument through untouched',
    (type) => {
      const pipe = new ZodValidationPipe(schema)

      expect(pipe.transform('line-addi', meta(type))).toBe('line-addi')
    },
  )

  // Called directly, without Nest, the caller means the body.
  it('validates when no metadata is supplied', () => {
    const pipe = new ZodValidationPipe(schema)

    expect(() => pipe.transform('not an object')).toThrow(BadRequestException)
  })
})
