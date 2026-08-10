'use client'

import { useCallback } from 'react'
import { useTranslations } from 'next-intl'
import type { ZodIssue } from 'zod'

/**
 * Translates a Zod issue raised by a schema in `@plinto/shared`.
 *
 * ── The seam, stated plainly ─────────────────────────────────────────────
 * `@plinto/shared` writes its validation messages as English prose
 * (`'At least one field must be provided'`) and both the API and this app
 * import the same schemas. Those messages are not codes, so there is nothing
 * stable to key a translation off except the English sentence itself — which
 * is what the table below does.
 *
 * That is a real weakness and it should be named rather than hidden: rename a
 * message in `@plinto/shared` and its Spanish translation silently falls back
 * to English. Nothing breaks loudly.
 *
 * The correct fix is for `@plinto/shared` to carry `code` on each refinement
 * the way the API's error envelope already does, and for this table to key off
 * that. That is a change across three packages and their tests, so it is
 * deliberately NOT bundled into the i18n work — see the note left for the
 * follow-up. Until then: this covers every custom message the schemas define
 * today, plus Zod's own built-in issue codes, and falls back to the raw
 * message so a missed case is merely untranslated, never blank.
 * ─────────────────────────────────────────────────────────────────────────
 */
const MESSAGE_KEY: Record<string, string> = {
  'At least one field must be provided': 'atLeastOneField',
  'Provide at least one field to update': 'atLeastOneField',
  'The amount due cannot exceed the closing balance': 'dueWithinBalance',
  'The installments already cover the whole principal; the last one would be empty':
    'lastInstallmentEmpty',
  'dueDate must fall inside period': 'dueDateInsidePeriod',
  'Source and destination accounts must differ': 'accountsMustDiffer',
}

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

      const byMessage = MESSAGE_KEY[issue.message]
      if (byMessage) return t(byMessage)

      const byCode = ISSUE_CODE_KEY[issue.code]
      if (byCode && t.has(byCode)) return t(byCode)

      // Untranslated but true, which beats a key or an empty box.
      return issue.message
    },
    [t],
  )
}
