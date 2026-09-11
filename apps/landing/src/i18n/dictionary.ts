// Landing-only i18n dictionary. This is intentionally small: it covers the
// layout chrome (page metadata, nav) that this skeleton ships with. Section
// content (hero, features, pricing, etc.) is added by whoever builds the
// actual sections, following the same shape.

export const locales = ['es', 'en'] as const

export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'es'

export interface Dictionary {
  meta: {
    title: string
    description: string
  }
  nav: {
    home: string
  }
  hero: {
    tagline: string
  }
}

// Real strings, ported verbatim from apps/web/messages/{es,en}.json
// (key: app.description) so the landing's headline promise never drifts
// from the product's own.
export const dictionaries: Record<Locale, Dictionary> = {
  es: {
    meta: {
      title: 'Plinto',
      description: 'Todo lo que gasta tu familia, en un solo lugar tranquilo.',
    },
    nav: {
      home: 'Inicio',
    },
    hero: {
      tagline: 'Todo lo que gasta tu familia, en un solo lugar tranquilo.',
    },
  },
  en: {
    meta: {
      title: 'Plinto',
      description: 'Everything your family spends, in one calm place.',
    },
    nav: {
      home: 'Home',
    },
    hero: {
      tagline: 'Everything your family spends, in one calm place.',
    },
  },
}
