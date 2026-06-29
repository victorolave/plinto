/**
 * Money rendering for Plinto.
 *
 * Product rules (from the design system):
 *  - Always show the currency; never blend currencies in one figure.
 *  - Income reads green; expenses render in ink (red is reserved for
 *    brand/error so it never competes).
 *  - Use a true minus `−` (not a hyphen) and tabular figures so columns align.
 *
 * Amounts are stored in minor units. The MVP assumes a ×100 minor-unit scale
 * for every currency (ADR 0004), so we force two fraction digits to match.
 */

export function formatMoneyMagnitude(minor: number, currency: string): string {
  const magnitudeMajor = Math.abs(minor) / 100
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(magnitudeMajor)
  } catch {
    // Unknown/invalid ISO code — fall back to "CODE 1,234.56".
    const number = new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(magnitudeMajor)
    return `${currency} ${number}`
  }
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
      {formatMoneyMagnitude(minor, currency)}
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
