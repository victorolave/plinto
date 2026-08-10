import { cookies, headers } from 'next/headers'
import { getRequestConfig } from 'next-intl/server'
import {
  DEFAULT_LOCALE,
  FORMATTING_LOCALE,
  LOCALE_COOKIE,
  isLocale,
  matchAcceptLanguage,
  type Locale,
} from './config'

/**
 * Resolves the locale for the current request, in priority order:
 *
 *   1. The `NEXT_LOCALE` cookie — an explicit choice the user made in Settings.
 *   2. The `Accept-Language` header — what the browser says they read.
 *   3. `DEFAULT_LOCALE` (Spanish).
 *
 * The order matters: a stated preference must always beat a sniffed one, or the
 * selector in Settings would appear to do nothing for a user whose browser
 * disagrees with their choice.
 */
export async function resolveLocale(): Promise<Locale> {
  const cookieLocale = cookies().get(LOCALE_COOKIE)?.value
  if (isLocale(cookieLocale)) return cookieLocale

  return matchAcceptLanguage(headers().get('accept-language')) ?? DEFAULT_LOCALE
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale()

  return {
    locale,

    // `formats` and `timeZone` are set here so that every `useFormatter()` /
    // `getFormatter()` call in the app inherits them. This is the fix for the
    // `Intl.NumberFormat(undefined, …)` pattern the codebase used to carry:
    // `undefined` means "ask the runtime", and the runtime is Node on the
    // server and the browser on the client. They disagree, and disagreeing
    // about a rendered string is a hydration mismatch.
    timeZone: 'America/Bogota',

    messages: (await import(`../../messages/${locale}.json`)).default,

    onError(error) {
      // A missing message must never take a page down. In development it should
      // be loud; in production it degrades to the key, which is ugly but alive.
      if (process.env.NODE_ENV === 'development') {
        console.error(error)
      }
    },

    getMessageFallback({ key, namespace }) {
      return namespace ? `${namespace}.${key}` : key
    },
  }
})

/**
 * The BCP 47 tag to hand to `Intl` for a resolved locale — `es` renders money
 * and dates as `es-CO`.
 */
export function formattingLocale(locale: Locale): string {
  return FORMATTING_LOCALE[locale]
}
