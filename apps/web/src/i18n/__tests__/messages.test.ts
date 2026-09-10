import { describe, expect, it } from 'vitest'
import { VALIDATION_CODE } from '@plinto/shared'
import en from '../../../messages/en.json'
import es from '../../../messages/es.json'
import { DEFAULT_LOCALE, LOCALES } from '../config'
import { auditCatalogues, type Catalogue } from '../catalogue-audit'

/**
 * Two hand-maintained catalogues drift. Someone adds a key while writing a
 * feature, translates the language they are working in, and the other one
 * silently renders the key path instead of a sentence — in production, on the
 * screen of the user who speaks the language nobody was testing.
 *
 * The rules themselves live in `catalogue-audit.ts` and are tested against
 * deliberately broken fixtures there, so this file only has to point them at
 * the real thing. Structural on purpose: nothing here claims a translation is
 * *good*, only that it exists, is not empty, and takes the same arguments.
 */

const CATALOGUES: Record<string, Catalogue> = { en, es }

describe('message catalogues', () => {
  it('covers every supported locale', () => {
    expect(Object.keys(CATALOGUES).sort()).toEqual([...LOCALES].sort())
  })

  it('is sound: same keys, same placeholders, nothing empty', () => {
    const problems = auditCatalogues({
      catalogues: CATALOGUES,
      // English is the reference only because it is where copy is authored;
      // the audit is symmetric, so a key present only in Spanish is reported
      // too.
      reference: 'en',
      requiredCodes: Object.values(VALIDATION_CODE),
    })

    // Reported as a list so a translator sees every gap in one run.
    expect(problems, `\n${problems.join('\n')}\n`).toEqual([])
  })

  it('can actually render the default locale', () => {
    // Cheap guard against the audit passing on two equally-empty catalogues.
    expect(Object.keys(CATALOGUES[DEFAULT_LOCALE] ?? {}).length).toBeGreaterThan(0)
  })
})
