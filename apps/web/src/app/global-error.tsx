'use client'

import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from '../i18n/config'

/**
 * `global-error` replaces the root layout when the root layout itself throws —
 * which means `NextIntlClientProvider` never mounted and `useTranslations` is
 * not available here. This is the one screen in the app that cannot read the
 * message catalogue.
 *
 * So it carries its own two-word dictionary and reads the locale straight off
 * the cookie. That is exactly why `setLocale` writes it without `httpOnly`:
 * the last-resort error screen has no server round trip left to ask.
 */
const TITLE: Record<Locale, string> = {
  es: 'Error inesperado',
  en: 'Unexpected error',
}

function localeFromCookie(): Locale {
  if (typeof document === 'undefined') return DEFAULT_LOCALE
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`))
  const value = match ? decodeURIComponent(match[1]) : undefined
  return isLocale(value) ? value : DEFAULT_LOCALE
}

export default function GlobalError() {
  const locale = localeFromCookie()

  return (
    <html lang={locale}>
      <body>
        <main style={{ padding: '2rem' }}>
          <h1>{TITLE[locale]}</h1>
        </main>
      </body>
    </html>
  )
}
