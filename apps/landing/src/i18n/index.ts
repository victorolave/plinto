import { defaultLocale, dictionaries, locales, type Dictionary, type Locale } from './dictionary'

export { defaultLocale, dictionaries, locales }
export type { Dictionary, Locale }

/**
 * Resolves the locale from an Astro page's URL, matching the routing
 * configured in astro.config.mjs (default locale un-prefixed at '/',
 * every other locale prefixed at '/<locale>/...').
 */
export function getLocaleFromUrl(url: URL): Locale {
  const [, maybeLocale] = url.pathname.split('/')
  return (locales as readonly string[]).includes(maybeLocale)
    ? (maybeLocale as Locale)
    : defaultLocale
}

/** Returns the string dictionary for a given locale. */
export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale]
}
