'use client'

import { useLocale } from 'next-intl'
import { DEFAULT_LOCALE, FORMATTING_LOCALE, isLocale } from './config'

/**
 * The BCP 47 tag every `Intl` call in the app must be given.
 *
 * Before i18n this codebase passed `undefined` to `Intl.NumberFormat` and
 * `toLocaleDateString`, which means "use the runtime's locale". On the server
 * that is Node's; in the browser it is the user's. Those two are routinely
 * different, and the moment they disagree the server HTML and the client's
 * first render disagree too — a hydration mismatch, on money and dates, which
 * are exactly the values nobody notices are subtly wrong.
 *
 * Reading it from the resolved request locale makes both sides agree by
 * construction, because both sides are handed the same tag.
 */
export function useFormattingLocale(): string {
  const locale = useLocale()
  return FORMATTING_LOCALE[isLocale(locale) ? locale : DEFAULT_LOCALE]
}
