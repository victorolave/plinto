import { describe, expect, it } from 'vitest'
import en from '../../../messages/en.json'
import es from '../../../messages/es.json'
import { LOCALES } from '../config'

/**
 * Two hand-maintained catalogues drift. Someone adds a key while writing a
 * feature, translates the language they are working in, and the other one
 * silently renders the key path instead of a sentence — in production, on the
 * screen of the user who speaks the language nobody was testing.
 *
 * These tests are the guardrail. They are deliberately structural rather than
 * about wording: nothing here asserts a translation is *good*, only that every
 * message exists in every language and takes the same placeholders.
 */

type Catalogue = Record<string, unknown>

const CATALOGUES: Record<string, Catalogue> = { en, es }

function flatten(value: Catalogue, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, child]) =>
    typeof child === 'object' && child !== null
      ? flatten(child as Catalogue, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  )
}

function read(catalogue: Catalogue, path: string): string {
  return path.split('.').reduce<unknown>(
    (node, segment) => (node as Catalogue)?.[segment],
    catalogue,
  ) as string
}

/** `{name}` and `{count, plural, …}` alike — the argument names a message needs. */
function placeholders(message: string): string[] {
  return [...message.matchAll(/\{\s*([a-zA-Z0-9_]+)\s*(?:,[^}]*)?\}/g)]
    .map((match) => match[1])
    .filter((name, index, all) => all.indexOf(name) === index)
    .sort()
}

describe('message catalogues', () => {
  it('covers every supported locale', () => {
    expect(Object.keys(CATALOGUES).sort()).toEqual([...LOCALES].sort())
  })

  it('defines the same keys in every language', () => {
    const reference = flatten(en).sort()

    for (const [locale, catalogue] of Object.entries(CATALOGUES)) {
      expect(flatten(catalogue).sort(), `${locale} key set`).toEqual(reference)
    }
  })

  it('uses the same placeholders for a key in every language', () => {
    for (const path of flatten(en)) {
      const expected = placeholders(read(en, path))

      for (const [locale, catalogue] of Object.entries(CATALOGUES)) {
        expect(placeholders(read(catalogue, path)), `${locale} → ${path}`).toEqual(
          expected,
        )
      }
    }
  })

  it('never leaves a message empty', () => {
    for (const [locale, catalogue] of Object.entries(CATALOGUES)) {
      for (const path of flatten(catalogue)) {
        expect(read(catalogue, path), `${locale} → ${path}`).not.toBe('')
      }
    }
  })
})
