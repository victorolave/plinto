import { describe, expect, it } from 'vitest'
import { DEFAULT_LOCALE, isLocale, matchAcceptLanguage } from '../config'

/**
 * `matchAcceptLanguage` decides what language a brand-new visitor sees, before
 * they have ever opened Settings. It is hand-written rather than pulled from
 * `negotiator` + `@formatjs/intl-localematcher`, so it carries its own tests
 * instead of leaning on somebody else's.
 */
describe('matchAcceptLanguage', () => {
  it('matches a plain tag', () => {
    expect(matchAcceptLanguage('es')).toBe('es')
    expect(matchAcceptLanguage('en')).toBe('en')
  })

  it('matches a regional tag on its primary subtag', () => {
    // The reason this exists: Colombian browsers send `es-CO`, and a naive
    // equality check against `es` would miss every single one of them.
    expect(matchAcceptLanguage('es-CO')).toBe('es')
    expect(matchAcceptLanguage('es-419')).toBe('es')
    expect(matchAcceptLanguage('en-GB')).toBe('en')
  })

  it('is case-insensitive', () => {
    expect(matchAcceptLanguage('ES-co')).toBe('es')
  })

  it('honours q-values rather than document order', () => {
    // Firefox and Chrome both send lists like this. Taking the first entry
    // would pick French here, which the user ranked last.
    expect(matchAcceptLanguage('fr;q=0.5,es;q=0.9')).toBe('es')
    expect(matchAcceptLanguage('es;q=0.2,en;q=0.8')).toBe('en')
  })

  it('treats a missing q-value as the highest preference', () => {
    expect(matchAcceptLanguage('en,es;q=0.9')).toBe('en')
  })

  it('ignores languages explicitly refused with q=0', () => {
    expect(matchAcceptLanguage('en;q=0,es;q=0.4')).toBe('es')
  })

  it('skips unsupported languages and takes the best supported one', () => {
    expect(matchAcceptLanguage('de,pt;q=0.9,es;q=0.4')).toBe('es')
  })

  it('returns null rather than inventing a fallback', () => {
    // The caller owns the fallback decision — see `resolveLocale`.
    expect(matchAcceptLanguage('de,fr,ja')).toBeNull()
    expect(matchAcceptLanguage('*')).toBeNull()
    expect(matchAcceptLanguage('')).toBeNull()
    expect(matchAcceptLanguage(null)).toBeNull()
    expect(matchAcceptLanguage(undefined)).toBeNull()
  })

  it('survives a malformed header instead of throwing', () => {
    // A header this broken is not worth a 500 on the whole page.
    expect(() => matchAcceptLanguage(';;;,,,q=')).not.toThrow()
    expect(matchAcceptLanguage('es;q=notanumber')).toBeNull()
  })
})

describe('isLocale', () => {
  it('accepts supported locales only', () => {
    expect(isLocale('es')).toBe(true)
    expect(isLocale('en')).toBe(true)
    expect(isLocale('es-CO')).toBe(false)
    expect(isLocale('de')).toBe(false)
    expect(isLocale(undefined)).toBe(false)
    expect(isLocale(null)).toBe(false)
    expect(isLocale(42)).toBe(false)
  })
})

describe('DEFAULT_LOCALE', () => {
  it('is Spanish, because Plinto is a Colombian household product', () => {
    expect(DEFAULT_LOCALE).toBe('es')
  })
})
