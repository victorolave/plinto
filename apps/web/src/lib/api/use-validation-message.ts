'use client'

import { useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { validationCodeOf } from '@plinto/shared'
import { ZodIssueCode, type ZodIssue } from 'zod'

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

/**
 * Zod's own issue codes, for the constraints the schemas did not word
 * themselves — a `.min(1)` or a `z.enum()` raises these, and they are Zod's to
 * name, not ours.
 *
 * Keyed off `ZodIssueCode` rather than string literals so a Zod upgrade that
 * renames or drops one of these is a COMPILE error here. As literals, the same
 * upgrade would have silently stopped matching and quietly fallen through to
 * Zod's untranslated English — the exact failure this file was rewritten to
 * eliminate for our own codes, reappearing one layer down.
 *
 * `ISSUE_CODE_KEY` is exported so its coverage can be asserted: a test checks
 * that every entry both fires on a real schema and has a translation.
 */
export const ISSUE_CODE_KEY = {
  [ZodIssueCode.too_small]: 'tooSmall',
  [ZodIssueCode.too_big]: 'tooBig',
  [ZodIssueCode.invalid_type]: 'invalidType',
  [ZodIssueCode.invalid_string]: 'invalidString',
  [ZodIssueCode.invalid_enum_value]: 'invalidEnumValue',
} as const satisfies Partial<Record<ZodIssue['code'], string>>

export function useValidationMessage(): (issue: ZodIssue | undefined) => string | null {
  const t = useTranslations('validation')

  return useCallback(
    (issue: ZodIssue | undefined): string | null => {
      if (!issue) return null

      const code = validationCodeOf(issue)
      if (code) return t(code)

      const byCode = (ISSUE_CODE_KEY as Record<string, string | undefined>)[issue.code]
      if (byCode && t.has(byCode)) return t(byCode)

      // A rule this package never tagged. Untranslated but true, which beats a
      // key path or an empty box.
      return issue.message
    },
    [t],
  )
}
