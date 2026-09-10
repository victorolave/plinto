/**
 * Minor units per currency — the reference table ADR 0004 requires.
 *
 * ADR 0004 says: "The number of decimals per currency is defined by
 * configuration/reference table (minor units per currency)." Until now nothing
 * implemented it; the web layer hardcoded a ×100 scale for every currency and
 * cited this ADR while contradicting it. For COP — the default currency of a
 * Plinto household — that was wrong twice over: it rendered `$ 2.300.000,00`
 * for a currency with no circulating centavo, and it burned two digits of a
 * 32-bit column on digits that are structurally always zero.
 *
 * WHY AN EXPLICIT TABLE AND NOT `Intl`
 *
 * `Intl.NumberFormat(...).resolvedOptions().maximumFractionDigits` returns
 * exactly these values, and deriving from it would be less code. It is
 * deliberately not used: the scale money is *stored* at must never depend on
 * how the runtime was built. A Node image compiled with small-icu would answer
 * differently, and the same amount would be persisted at two different scales
 * depending on which container wrote it — a corruption no test in the writing
 * process would catch.
 *
 * The table is therefore the source of truth, and `currency.test.ts` asserts it
 * agrees with `Intl` for every entry. Divergence from CLDR is caught in CI
 * rather than in production data.
 *
 * Values follow CLDR's currency digits, which track actual circulation, rather
 * than the ISO 4217 column — the two disagree for exactly the case that matters
 * here: ISO still lists COP with 2 decimals for a centavo nobody has used in
 * decades.
 */

/**
 * Currencies whose minor unit is not 1/100. Everything absent uses the default.
 *
 * EXHAUSTIVE, not representative. A currency missing from this table falls back
 * to two decimals, so an amount in it would be stored ×100 while `Intl` renders
 * it with none — the same divisor/format mismatch this module removes, just
 * narrowed to a currency nobody tested. `currency.test.ts` therefore walks
 * every code `Intl.supportedValuesOf('currency')` knows and fails if one with a
 * non-default scale is missing here.
 */
const MINOR_UNIT_EXPONENTS: Readonly<Record<string, number>> = Object.freeze({
  // No minor unit in circulation: the minor unit *is* the currency.
  AFN: 0,
  ALL: 0,
  BIF: 0,
  CLP: 0,
  COP: 0,
  DJF: 0,
  GNF: 0,
  HUF: 0,
  IDR: 0,
  // ISO 4217 still lists IQD with three decimals; the fils has not circulated
  // for decades and CLDR records zero. The same disagreement as COP, and the
  // reason this table follows CLDR rather than the ISO column.
  IQD: 0,
  IRR: 0,
  ISK: 0,
  JPY: 0,
  KMF: 0,
  KPW: 0,
  KRW: 0,
  LAK: 0,
  LBP: 0,
  MGA: 0,
  MMK: 0,
  PKR: 0,
  PYG: 0,
  RWF: 0,
  SLL: 0,
  SOS: 0,
  SYP: 0,
  UGX: 0,
  VND: 0,
  VUV: 0,
  XAF: 0,
  XOF: 0,
  XPF: 0,
  YER: 0,
  // Thousandths.
  BHD: 3,
  JOD: 3,
  KWD: 3,
  LYD: 3,
  OMR: 3,
  TND: 3,
})

/** The overwhelming majority of currencies divide into hundredths. */
export const DEFAULT_MINOR_UNIT_EXPONENT = 2

/** Currency codes this table describes explicitly. Exported for tests. */
export const CURRENCIES_WITH_NON_DEFAULT_MINOR_UNITS = Object.freeze(
  Object.keys(MINOR_UNIT_EXPONENTS),
)

/**
 * How many decimal places `currency` admits. Unknown codes fall back to 2,
 * which is right far more often than it is wrong and never throws — a bad
 * currency code must not take down a page that is only trying to render a
 * number.
 */
export function minorUnitExponent(currency: string): number {
  return MINOR_UNIT_EXPONENTS[currency?.toUpperCase()] ?? DEFAULT_MINOR_UNIT_EXPONENT
}

/** Minor units in one major unit: 100 for USD, 1 for COP, 1000 for KWD. */
export function minorUnitScale(currency: string): number {
  return 10 ** minorUnitExponent(currency)
}

/**
 * Convert a major-unit amount to minor units, exactly.
 *
 * The decimal point is shifted by string manipulation rather than multiplied,
 * because `Math.round(x * 100)` is wrong for values a user can plausibly type:
 * `4.005 * 100` is `400.49999999999994` in binary floating point, so the old
 * code rounded 4.005 down to 400 minor units and quietly lost a cent. Shifting
 * digits cannot lose one.
 *
 * Rounding is half-up on the first dropped digit, matching what a person
 * expects when they type more decimals than the currency admits.
 *
 * Returns NaN for input that is not a number, so callers keep their existing
 * `Number.isNaN` guards.
 */
export function toMinorUnits(major: string | number, currency: string): number {
  const exponent = minorUnitExponent(currency)
  const text = typeof major === 'number' ? String(major) : major.trim()

  // Exponential notation ("1e-7", "1e+21") is not something a money field
  // produces; fall back rather than mis-parse it.
  if (/[eE]/.test(text)) {
    const value = Number(text)
    return Number.isFinite(value) ? Math.round(value * 10 ** exponent) : NaN
  }

  const match = /^([+-])?(\d*)(?:\.(\d*))?$/.exec(text)
  if (!match || (match[2] === '' && (match[3] ?? '') === '')) {
    return NaN
  }

  const sign = match[1] === '-' ? -1 : 1
  const integerDigits = match[2] || '0'
  const fractionDigits = match[3] ?? ''

  const kept = (fractionDigits + '0'.repeat(exponent)).slice(0, exponent)
  const dropped = fractionDigits.slice(exponent)

  let value = Number(integerDigits + kept)
  if (dropped !== '' && Number(dropped[0]) >= 5) {
    value += 1
  }

  return sign * value
}

/**
 * Convert minor units back to a major-unit number, for prefilling an editable
 * amount field. Exact for every currency here: the scale is a power of ten and
 * the input is an integer.
 */
export function toMajorUnits(minor: number, currency: string): number {
  return minor / minorUnitScale(currency)
}

/**
 * The major-unit amount as a string with exactly the decimals the currency
 * admits — `"2300000"` for COP, `"1234.50"` for USD. What an amount input
 * should be prefilled with when editing an existing record.
 */
export function toMajorUnitsString(minor: number, currency: string): string {
  return toMajorUnits(minor, currency).toFixed(minorUnitExponent(currency))
}
