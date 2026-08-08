import { formatMoneyMagnitude } from '../components/ui/amount'

/**
 * The money string a component will actually render, ready to hand to
 * `getByText` / `findByText`.
 *
 * `Intl` separates a currency code from its digits with a NO-BREAK SPACE
 * (U+00A0) — `"COP 100,000"`. Testing Library normalises the DOM's
 * whitespace to ordinary spaces before matching but leaves the expected string
 * untouched, so passing `formatMoneyMagnitude(...)` straight into a query fails
 * on a character nobody can see in the diff.
 *
 * It never came up before because the currencies under test formatted without a
 * separator at all (`"$1,234.50"`). It appears the moment a test asserts on COP,
 * which is the household default.
 */
export function money(minor: number, currency: string): string {
  return formatMoneyMagnitude(minor, currency).replace(/\u00a0/g, ' ')
}
