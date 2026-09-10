import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common'
import { IdempotencyKeySchema } from '@plinto/shared'

/**
 * Validates the optional `Idempotency-Key` header on `POST /transactions/transfers`.
 *
 * Applied by hand to the raw header value inside `TransactionsController`
 * (this Nest version's `@Headers()` has no pipe-applying overload), not
 * declared via a decorator — so, unlike `ZodValidationPipe`, there is no
 * `body`-only metadata to filter on here.
 *
 * The header always arrives as a single `string | undefined`, never an
 * array: Express joins a repeated header into one comma-separated string
 * (`req.headers['idempotency-key']` is `"a, b"` for two sends, not `['a',
 * 'b']`) rather than handing back a list — Node only does that for a small
 * fixed set of headers (`set-cookie` chief among them), and this is not one
 * of them. So a repeated header does not get "first value wins" treatment;
 * it degrades to one garbled string, which the length/format check below
 * naturally rejects if it does not fit — there is nothing to split.
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
export class IdempotencyKeyPipe implements PipeTransform<string | undefined, string | undefined> {
  transform(value: string | undefined): string | undefined {
    if (value === undefined) return undefined

    const result = IdempotencyKeySchema.safeParse(value)

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
