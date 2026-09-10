import { formatMoneyMagnitude } from '../components/ui/amount'
import { FORMATTING_LOCALE, type Locale } from '../i18n/config'
import { TEST_LOCALE } from './render-with-providers'

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
 *
 * `locale` must match the locale the component under test is rendered in, or
 * the expected string and the DOM disagree on separators \u2014 `1,234.50` against
 * `1.234,50`. It defaults to `TEST_LOCALE` for the same reason
 * `renderWithProviders` does.
 */
export function money(
  minor: number,
  currency: string,
  locale: Locale = TEST_LOCALE,
): string {
  return formatMoneyMagnitude(minor, currency, FORMATTING_LOCALE[locale]).replace(
    /\u00a0/g,
    ' ',
  )
}
