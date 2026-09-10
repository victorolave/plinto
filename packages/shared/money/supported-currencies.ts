import { z } from 'zod'

/**
 * The currencies a household may actually hold — a closed set, deliberately.
 *
 * WHY THIS EXISTS
 *
 * Every currency field used to validate as `z.string().regex(/^[A-Z]{3}$/)`.
 * That checks the *shape* of a currency code and nothing about whether the
 * currency exists, so `XXX`, `ABC` and `QQQ` were all accepted by the API — not
 * only by the form, but by any caller, script or future importer.
 *
 * On its own that would be a cosmetic annoyance. It is not, because
 * `minorUnitExponent` answers `DEFAULT_MINOR_UNIT_EXPONENT` for a code it does
 * not know and never throws — a deliberate choice, so that one bad code cannot
 * take down a page that is only rendering a number. The two behaviours compose
 * badly: a mistyped code is accepted, then silently scaled at two decimals. For
 * a household whose default currency is COP — which has none — that stores and
 * renders every amount a hundred times off, with no error anywhere to notice.
 *
 * Closing the set is what turns "the form offers sensible options" into an
 * invariant the API enforces. The picker in the UI is then a consequence of the
 * contract rather than the only thing holding the line.
 *
 * WHY THESE CODES
 *
 * Plinto is a Colombian household product, so the list is the money a Colombian
 * household plausibly holds, not every code CLDR knows:
 *
 * - `COP` — home currency and the `Tenant.baseCurrency` default.
 * - `USD` — how savings and prices are quoted here in practice.
 * - `EUR`, `GBP`, `CAD` — where remittances and relatives most often are.
 * - `MXN`, `ARS`, `BRL`, `CLP`, `PEN`, `UYU` — the neighbours, so the product
 *   is not structurally Colombian-only the day someone else self-hosts it.
 *
 * Adding a code is a one-line change plus a passing test. Removing one is not:
 * stored rows would stop validating, so anything already persisted must stay.
 */
export const SUPPORTED_CURRENCIES = [
  'COP',
  'USD',
  'EUR',
  'GBP',
  'CAD',
  'MXN',
  'ARS',
  'BRL',
  'CLP',
  'PEN',
  'UYU',
] as const

/** A currency code Plinto accepts. Narrower than `string` on purpose. */
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number]

/**
 * The single currency validator every contract should use.
 *
 * Trims first, because the create contracts trimmed before this existed and
 * narrowing the accepted set must not also start rejecting input that used to
 * pass for an unrelated reason. Case is *not* normalised for the same reason
 * in reverse: lowercase was rejected before, so accepting it now would be a
 * silent widening rather than the tightening this change is for.
 */
export const CurrencyCodeSchema = z
  .string()
  .trim()
  .pipe(z.enum(SUPPORTED_CURRENCIES))

/** Type guard for the boundaries where a plain `string` arrives. */
export function isSupportedCurrency(value: string): value is SupportedCurrency {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(value)
}
