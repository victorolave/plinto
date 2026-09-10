import { Transaction, Transfer } from './transaction.entity'

/**
 * Everything a caller controls on `POST /transactions/transfers`, exactly as
 * given — before account lookups, currency derivation, or `occurredAt`
 * defaulting to "now". Fingerprinting compares against THIS shape, not the
 * resolved one `TransactionRepository.createTransfer` is called with: see
 * `transferMatchesFingerprint` for why that distinction matters.
 */
export interface TransferFingerprintRequest {
  sourceAccountId: string
  destinationAccountId: string
  sourceAmountMinor: number
  destinationAmountMinor?: number
  fxRate?: string
  feeMinor?: number
  description?: string
  occurredAt?: string
}

/**
 * True when `request` describes the exact same transfer `existing` already
 * recorded — the only condition under which an `Idempotency-Key` collision
 * may return the original instead of being rejected as reused.
 *
 * This exists because the key alone is not enough: matching only on
 * `(tenantId, idempotencyKey)` lets a caller who edits the amount between a
 * lost response and a retry get the FIRST amount's transfer back with a
 * quiet `200`, never learning their edited request was never applied. Every
 * material field the caller supplied has to match too, or this rejects with
 * `IDEMPOTENCY_KEY_REUSED` instead of resolving quietly.
 *
 * Two fields need a default before comparing, and both defaults are
 * deterministic — not time-based — so they are safe to compare across any
 * number of retries:
 * - `destinationAmountMinor` defaults to `sourceAmountMinor` (a same-currency
 *   transfer's own default). A cross-currency transfer requires both fields
 *   together at the schema level, so an omitted `destinationAmountMinor` can
 *   only legitimately match a same-currency `existing` transfer — this
 *   function does not need to know which kind `existing` is.
 * - `fxRate` and `feeMinor` default to `null`, the same-currency default.
 *
 * `occurredAt` is different: omitted, it resolves to `new Date()` at request
 * time, a value that differs by however long elapsed between any two calls
 * — including two calls that are both perfectly legitimate retries of the
 * same intent. Comparing against that resolved value would reject the
 * ordinary case (nobody sends `occurredAt` for "now"). So when the caller
 * omits it here, it is simply not checked: the caller expressed no
 * preference, and none is enforced.
 */
export function transferMatchesFingerprint(
  existing: { transfer: Transfer; debit: Transaction },
  request: TransferFingerprintRequest,
): boolean {
  const { transfer, debit } = existing

  if (transfer.sourceAccountId !== request.sourceAccountId) return false
  if (transfer.destinationAccountId !== request.destinationAccountId) return false
  if (transfer.sourceAmountMinor !== request.sourceAmountMinor) return false

  const expectedDestinationAmountMinor = request.destinationAmountMinor ?? request.sourceAmountMinor
  if (transfer.destinationAmountMinor !== expectedDestinationAmountMinor) return false

  if (!sameDecimal(transfer.fxRate, request.fxRate ?? null)) return false
  if (transfer.feeMinor !== (request.feeMinor ?? null)) return false
  if (debit.description !== (request.description ?? null)) return false

  if (request.occurredAt !== undefined) {
    const requestedTime = new Date(request.occurredAt).getTime()
    if (debit.occurredAt.getTime() !== requestedTime) return false
  }

  return true
}

/**
 * Compares two decimal strings by value, not by text.
 *
 * `Transfer.fxRate` round-trips through Prisma's `Decimal`, which can
 * normalize `"4200.00"` to `"4200"` — a formatting difference, not a
 * different rate. A raw string comparison would reject a genuine retry that
 * sent the same rate with different trailing zeros.
 */
function sameDecimal(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return a === b
  return Number(a) === Number(b)
}
