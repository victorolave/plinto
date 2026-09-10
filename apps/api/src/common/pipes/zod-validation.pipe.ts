import { ArgumentMetadata, BadRequestException, PipeTransform } from '@nestjs/common'
import { ZodSchema } from 'zod'

/**
 * Validates a request body against a Zod schema.
 *
 * **Only the body.** Every schema this pipe is given describes one, and Nest
 * runs a method-scoped pipe against *each* argument of the handler — so on a
 * route like `PATCH /:id`, an unfiltered pipe also receives the `id` path
 * parameter and rejects the request with `Expected object, received string`
 * before the body is ever looked at. The failure names the schema, not the
 * parameter, so it reads like a client mistake.
 *
 * Filtering here rather than at the call sites is deliberate: it fixes every
 * route at once and keeps `@UsePipes(...)` safe to reach for, instead of
 * leaving a rule about decorator placement that has to be remembered on each
 * new handler. Three routes had already broken this way.
 */
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown, metadata?: ArgumentMetadata) {
    // `metadata` is optional so the pipe stays callable directly in tests.
    // Absent, the caller is validating deliberately and means the body.
    if (metadata && metadata.type !== 'body') {
      return value
    }

    const result = this.schema.safeParse(value)
    if (!result.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
        details: result.error.issues,
      })
    }
    return result.data
  }
}
