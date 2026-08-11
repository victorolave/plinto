import { describe, expect, it } from 'vitest'
import {
  auditCatalogues,
  flattenKeys,
  placeholdersOf,
  readMessage,
  type Catalogue,
} from '../catalogue-audit'

/**
 * Tests for the guard itself.
 *
 * `messages.test.ts` asserts the real catalogues are sound — but a check that
 * never fires is indistinguishable from a check that cannot. Proving the
 * difference used to mean deleting a key from `es.json` by hand, running the
 * suite, and putting it back: a one-time act that left nothing behind.
 *
 * Every fault below is a fault that actually happened or nearly did. They run
 * against fixtures, so the real catalogues are never touched and this holds
 * for everyone, forever, in CI.
 */

const EN: Catalogue = {
  common: { save: 'Save', cancel: 'Cancel' },
  greeting: 'Hello, {name}',
  items: '{count, plural, one {# item} other {# items}}',
  validation: { AT_LEAST_ONE_FIELD: 'At least one field must be provided' },
}

/** A faithful translation — the shape every assertion below deviates from. */
const ES: Catalogue = {
  common: { save: 'Guardar', cancel: 'Cancelar' },
  greeting: 'Hola, {name}',
  items: '{count, plural, one {# elemento} other {# elementos}}',
  validation: { AT_LEAST_ONE_FIELD: 'Hay que indicar al menos un campo' },
}

const audit = (es: Catalogue, requiredCodes: readonly string[] = []) =>
  auditCatalogues({ catalogues: { en: EN, es }, reference: 'en', requiredCodes })

/** Deep clone so a mutation in one test cannot leak into the next. */
const clone = (value: Catalogue): Catalogue => JSON.parse(JSON.stringify(value))

describe('auditCatalogues', () => {
  it('reports nothing when the catalogues agree', () => {
    expect(audit(ES)).toEqual([])
  })

  it('catches a key missing from a translation', () => {
    const broken = clone(ES)
    delete (broken.common as Catalogue).cancel

    expect(audit(broken)).toEqual(['es is missing common.cancel'])
  })

  it('catches a key that exists only in the translation', () => {
    const broken = clone(ES)
    ;(broken.common as Catalogue).extra = 'Sobra'

    expect(audit(broken)).toEqual(['es has common.extra, which en does not'])
  })

  it('catches an empty message', () => {
    const broken = clone(ES)
    ;(broken.common as Catalogue).save = ''

    expect(audit(broken)).toEqual(['es → common.save is empty'])
  })

  it('catches a placeholder that was dropped in translation', () => {
    const broken = clone(ES)
    // The kind of typo that renders "Hola, " to a real person.
    broken.greeting = 'Hola'

    expect(audit(broken)).toEqual(['es → greeting expects [name] but has []'])
  })

  it('catches a placeholder that was renamed in translation', () => {
    const broken = clone(ES)
    broken.greeting = 'Hola, {nombre}'

    expect(audit(broken)).toEqual(['es → greeting expects [name] but has [nombre]'])
  })

  it('catches a plural losing its count argument', () => {
    const broken = clone(ES)
    broken.items = 'varios elementos'

    expect(audit(broken)).toEqual(['es → items expects [count] but has []'])
  })

  it('catches a validation code with no translation', () => {
    const broken = clone(ES)
    delete (broken.validation as Catalogue).AT_LEAST_ONE_FIELD

    expect(audit(broken, ['AT_LEAST_ONE_FIELD'])).toEqual([
      'es is missing validation.AT_LEAST_ONE_FIELD',
      'es has no translation for validation code AT_LEAST_ONE_FIELD',
    ])
  })

  it('catches a code that no catalogue ever had', () => {
    // A rule added in @plinto/shared and translated nowhere.
    expect(audit(ES, ['BRAND_NEW_RULE'])).toEqual([
      'en has no translation for validation code BRAND_NEW_RULE',
      'es has no translation for validation code BRAND_NEW_RULE',
    ])
  })

  it('reports every fault at once, not just the first', () => {
    const broken = clone(ES)
    delete (broken.common as Catalogue).cancel
    broken.greeting = 'Hola'

    // A translator fixing three keys should see three, not run the suite three
    // times to find them one at a time.
    expect(audit(broken)).toHaveLength(2)
  })

  it('says so plainly when the reference locale is not there at all', () => {
    expect(
      auditCatalogues({ catalogues: { es: ES }, reference: 'en' }),
    ).toEqual(['reference locale "en" is not among the catalogues'])
  })
})

describe('placeholdersOf', () => {
  it.each([
    ['no arguments', 'Plain text', []],
    ['a simple argument', 'Hello, {name}', ['name']],
    ['an ICU plural', '{count, plural, one {# item} other {# items}}', ['count']],
    ['several, sorted and deduped', '{b} and {a} and {b}', ['a', 'b']],
    ['whitespace inside the braces', 'Hi { name }', ['name']],
  ])('reads %s', (_label, message, expected) => {
    expect(placeholdersOf(message)).toEqual(expected)
  })
})

describe('readMessage', () => {
  it('reads a nested path', () => {
    expect(readMessage(EN, 'common.save')).toBe('Save')
  })

  it('returns undefined for a path that leads nowhere, without throwing', () => {
    expect(readMessage(EN, 'common.nope')).toBeUndefined()
    expect(readMessage(EN, 'nope.nope.nope')).toBeUndefined()
  })

  it('returns undefined for a branch, which is not a message', () => {
    expect(readMessage(EN, 'common')).toBeUndefined()
  })
})

describe('flattenKeys', () => {
  it('returns leaf paths only', () => {
    expect(flattenKeys(EN).sort()).toEqual([
      'common.cancel',
      'common.save',
      'greeting',
      'items',
      'validation.AT_LEAST_ONE_FIELD',
    ])
  })
})
