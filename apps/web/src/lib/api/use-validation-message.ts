'use client'

import { useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { validationCodeOf } from '@plinto/shared'
import type { ZodIssue } from 'zod'

/**
 * Translates a Zod issue raised by a schema in `@plinto/shared`.
 *
 * This used to key off the English message text, because a `.refine()` carried
 * nothing else — rewording a sentence in `@plinto/shared` dropped its Spanish
 * translation with no failing test and no visible symptom beyond one English
 * line in a translated form.
 *
 * The schemas tag their issues with a `VALIDATION_CODE` now, and the catalogue
 * is keyed by that code. `validationCodeOf` lives in `@plinto/shared` beside
 * the codes themselves, so the writing and the reading of the contract cannot
 * drift apart. A code with no translation fails `messages.test.ts` in CI.
 */

/** Zod's own issue codes, for the constraints the schemas did not word themselves. */
const ISSUE_CODE_KEY: Record<string, string> = {
  too_small: 'tooSmall',
  too_big: 'tooBig',
  invalid_type: 'invalidType',
  invalid_string: 'invalidString',
  invalid_enum_value: 'invalidEnumValue',
}

export function useValidationMessage(): (issue: ZodIssue | undefined) => string | null {
  const t = useTranslations('validation')

  return useCallback(
    (issue: ZodIssue | undefined): string | null => {
      if (!issue) return null

      const code = validationCodeOf(issue)
      if (code) return t(code)

      const byCode = ISSUE_CODE_KEY[issue.code]
      if (byCode && t.has(byCode)) return t(byCode)

      // A rule this package never tagged. Untranslated but true, which beats a
      // key path or an empty box.
      return issue.message
    },
    [t],
  )
}
