'use client'

import { minorUnitExponent, toMajorUnits } from '@plinto/shared'
import { FALLBACK_FORMATTING_LOCALE } from '../../i18n/config'
import { useFormattingLocale } from '../../i18n/formatting'

/**
 * Money rendering for Plinto.
 *
 * Product rules (from the design system):
 *  - Always show the currency; never blend currencies in one figure.
 *  - Income reads green; expenses render in ink (red is reserved for
 *    brand/error so it never competes).
 *  - Use a true minus `−` (not a hyphen) and tabular figures so columns align.
 *
 * Amounts are stored in minor units, at the scale the currency actually uses —
 * the reference table ADR 0004 asks for, in `@plinto/shared`. This file used to
 * assume ×100 for every currency and force two fraction digits, which rendered
 * `$ 2.300.000,00` for a peso that has no centavo.
 *
 * The divisor and the fraction digits are read from the same function on
 * purpose. Taking them from two places is how they drift apart, and a figure
 * divided by one scale and printed at another is wrong in a way that still
 * looks like money.
 */

/**
 * `locale` used to be `undefined` — "whatever the runtime says". That is the
 * hydration bug described in `i18n/formatting.ts`: it makes the server and the
 * browser format the same amount differently. The `Amount` component below
 * passes the real request locale; the default only covers non-React callers.
 */
export function formatMoneyMagnitude(
  minor: number,
  currency: string,
  locale: string = FALLBACK_FORMATTING_LOCALE,
): string {
  const magnitudeMajor = toMajorUnits(Math.abs(minor), currency)
  const fractionDigits = minorUnitExponent(currency)

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(magnitudeMajor)
  } catch {
    // Unknown/invalid ISO code — fall back to "CODE 1,234.56".
    const number = new Intl.NumberFormat(locale, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(magnitudeMajor)
    return `${currency} ${number}`
  }
}

/**
 * The `step` an amount `<input type="number">` should use for `currency`:
 * `"1"` where there is no minor unit, `"0.01"` for hundredths, `"0.001"` for
 * thousandths.
 *
 * Every money field used to hardcode `step="0.01"` — the same ×100 assumption
 * wearing an HTML attribute. It let someone type `2300000.55` pesos, which the
 * conversion then rounded away without saying so.
 */
export function amountInputStep(currency: string): string {
  const exponent = minorUnitExponent(currency)
  return exponent === 0 ? '1' : `0.${'0'.repeat(exponent - 1)}1`
}

export interface AmountProps {
  /** Signed value in minor units. */
  minor: number
  currency: string
  size?: 'sm' | 'md' | 'lg'
  /** Colorize positive as income green / negative as ink. Default off (plain ink). */
  colorize?: boolean
  /** Prefix `+` for positive values; negatives always show a true minus. */
  showSign?: boolean
  className?: string
}

export function Amount({
  minor,
  currency,
  size = 'md',
  colorize = false,
  showSign = false,
  className = '',
}: AmountProps) {
  const formattingLocale = useFormattingLocale()
  const isNegative = minor < 0
  const sign = isNegative ? '−' : showSign && minor > 0 ? '+' : ''
  const toneClass = colorize
    ? isNegative
      ? 'amount--negative'
      : 'amount--positive'
    : ''
  const classes = ['amount', `amount--${size}`, toneClass, className]
    .filter(Boolean)
    .join(' ')

  return (
    <span className={classes}>
      {sign}
      {formatMoneyMagnitude(minor, currency, formattingLocale)}
    </span>
  )
}

export interface CurrencyTagProps {
  currency: string
  className?: string
}

export function CurrencyTag({ currency, className = '' }: CurrencyTagProps) {
  return <span className={`currency-tag ${className}`.trim()}>{currency}</span>
}
