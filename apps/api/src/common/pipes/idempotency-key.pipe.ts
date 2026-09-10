import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common'
import { IdempotencyKeySchema } from '@plinto/shared'

/**
 * Validates the optional `Idempotency-Key` header on `POST /transactions/transfers`.
 *
 * Applied directly to the extracted header value (`@Headers('idempotency-key',
 * IdempotencyKeyPipe)`), not to the whole request — so, unlike
 * `ZodValidationPipe`, there is no `body`-only metadata to filter on here.
 *
 * Absent means "no idempotency requested" and passes through as `undefined`,
 * which is today's behaviour: nothing about this pipe changes a request that
 * never sends the header. Present, it is trimmed and must fit the same
 * 1-200 character window the `transfers.idempotency_key` column accepts;
 * anything else raises the project's standard `VALIDATION_ERROR` shape, the
 * same one `ZodValidationPipe` uses for the body, so the `data`/`error`
 * envelope stays one contract regardless of where a request went wrong.
 */
@Injectable()
export class IdempotencyKeyPipe
  implements PipeTransform<string | string[] | undefined, string | undefined>
{
  transform(value: string | string[] | undefined): string | undefined {
    if (value === undefined) return undefined

    // Express lower-cases header names and hands back an array only if the
    // header repeated; the first occurrence wins, matching how
    // RequestIdMiddleware and TenantGuard already resolve a repeated header.
    const raw = Array.isArray(value) ? value[0] : value
    const result = IdempotencyKeySchema.safeParse(raw)

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
