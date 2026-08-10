/**
 * The locale contract for Plinto.
 *
 * Plinto is a private dashboard behind OIDC, so the locale is NOT part of the
 * URL: there is no `/es/dashboard` vs `/en/dashboard`. Localised URLs buy SEO,
 * and an authenticated household ledger has no SEO to buy. The locale lives in
 * a cookie instead, which keeps all 22 App Router files exactly where they are.
 *
 * Everything that needs to know "which language is this request?" resolves it
 * through here — never by reading the runtime's ambient locale. That ambient
 * read is precisely what makes a server render disagree with a client render.
 */

export const LOCALES = ['es', 'en'] as const

export type Locale = (typeof LOCALES)[number]

/**
 * The fallback when the request tells us nothing usable — no cookie and no
 * recognisable `Accept-Language`. Spanish, because Plinto is a Colombian
 * household product: base currency COP, real users speak Spanish.
 */
export const DEFAULT_LOCALE: Locale = 'es'

/** The cookie that carries an explicit user choice, set from Settings. */
export const LOCALE_COOKIE = 'NEXT_LOCALE'

/**
 * A year. The locale is a stated preference, not a session detail — it should
 * outlive the session cookie, which expires on idle timeout.
 */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

/** The BCP 47 tag each locale formats numbers and dates with. */
export const FORMATTING_LOCALE: Record<Locale, string> = {
  // Colombian Spanish: `1.234.567,89` and `$ 1.234.567`. Plain `es` would give
  // the European convention for some formats; the household reads Colombian.
  es: 'es-CO',
  en: 'en-US',
}

/**
 * The tag pure formatting helpers use when no locale is passed in.
 *
 * Every `Intl` call in this app takes an explicit locale. Where a helper is
 * called outside React (a lib function, a test) there is no hook to read it
 * from, so it falls back to this — a fixed, known value. Never `undefined`,
 * which would hand the decision back to the runtime and reintroduce the
 * server/client formatting split.
 */
export const FALLBACK_FORMATTING_LOCALE = 'es-CO'

/** Human labels for the language selector, each written in its own language. */
export const LOCALE_LABELS: Record<Locale, string> = {
  es: 'Español',
  en: 'English',
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

/**
 * Picks the best supported locale from an `Accept-Language` header.
 *
 * Written out rather than pulled from `negotiator` + `@formatjs/intl-localematcher`
 * because those two packages exist to do RFC 4647 lookup against dozens of tags,
 * and we support two. The whole job here is: read the q-values, sort, match on
 * the primary subtag so `es-CO`, `es-419` and `es` all land on Spanish.
 *
 * Returns `null` when nothing matches, so the caller decides the fallback
 * instead of this function silently inventing one.
 */
export function matchAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null

  const ranked = header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';')
      const q = params
        .map((p) => p.trim())
        .find((p) => p.startsWith('q='))
        ?.slice(2)
      const quality = q === undefined ? 1 : Number.parseFloat(q)
      return {
        // `es-CO` -> `es`. A wildcard `*` matches nothing here on purpose: it
        // means "any", which is the same as expressing no preference.
        language: tag.toLowerCase().split('-')[0],
        quality: Number.isFinite(quality) ? quality : 0,
      }
    })
    .filter((entry) => entry.quality > 0)
    .sort((a, b) => b.quality - a.quality)

  for (const entry of ranked) {
    const match = LOCALES.find((locale) => locale === entry.language)
    if (match) return match
  }

  return null
}
