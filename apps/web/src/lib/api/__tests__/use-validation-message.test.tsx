import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { z } from 'zod'
import { VALIDATION_CODE, validationParams } from '@plinto/shared'
import { renderWithProviders } from '../../../test/render-with-providers'
import { useValidationMessage } from '../use-validation-message'
import type { Locale } from '../../../i18n/config'

/**
 * The regression this file exists for.
 *
 * `useValidationMessage` used to look the translation up by the English
 * sentence a `.refine()` carried. Reword that sentence in `@plinto/shared` and
 * the Spanish silently disappeared — no failing test, no error, just one
 * English line inside a translated form.
 *
 * These tests pin the new contract: the CODE decides the translation, and the
 * message is only a last resort for rules this package never tagged.
 */

function Probe({ issue }: { issue: z.ZodIssue | undefined }) {
  const toValidationMessage = useValidationMessage()
  return <span data-testid="message">{toValidationMessage(issue) ?? '(null)'}</span>
}

function messageFor(issue: z.ZodIssue | undefined, locale: Locale = 'en'): string {
  // Unmounts before returning so callers can loop over locales and codes
  // without stacking probes that all answer to the same test id.
  const { unmount } = renderWithProviders(<Probe issue={issue} />, { locale })
  const text = screen.getByTestId('message').textContent ?? ''
  unmount()
  return text
}

/** The first issue a schema raises for input it must reject. */
function firstIssue(schema: z.ZodTypeAny, input: unknown): z.ZodIssue {
  const result = schema.safeParse(input)
  return (result as z.SafeParseError<unknown>).error.issues[0]
}

describe('useValidationMessage', () => {
  it('translates from the code, not from the English message', () => {
    // A rule tagged with our code but carrying deliberately unrecognisable
    // prose — exactly what a reword in @plinto/shared looks like.
    const reworded = z.string().refine(() => false, {
      message: 'a sentence nobody has ever translated',
      params: validationParams(VALIDATION_CODE.AT_LEAST_ONE_FIELD),
    })

    expect(messageFor(firstIssue(reworded, 'x'), 'es')).toBe(
      'Hay que indicar al menos un campo',
    )
  })

  it('resolves every declared code in both languages', () => {
    for (const code of Object.values(VALIDATION_CODE)) {
      const schema = z.string().refine(() => false, {
        message: 'ignored',
        params: validationParams(code),
      })
      const issue = firstIssue(schema, 'x')

      for (const locale of ['en', 'es'] as const) {
        const message = messageFor(issue, locale)

        expect(message, `${locale} → ${code}`).not.toBe('')
        // A missing key would render as the namespaced path, not a sentence.
        expect(message, `${locale} → ${code} fell back to the key`).not.toContain(
          `validation.${code}`,
        )
      }
    }
  })

  it("falls back to Zod's own wording for issues we never tagged", () => {
    const issue = firstIssue(z.object({ a: z.string() }), { a: 1 })

    expect(issue.code).toBe('invalid_type')
    expect(messageFor(issue)).toBe('That value is not valid')
  })

  it('returns the raw message for a custom rule with no code', () => {
    const untagged = z.string().refine(() => false, { message: 'something specific' })

    // Untranslated but true — better than a key path or an empty box.
    expect(messageFor(firstIssue(untagged, 'x'))).toBe('something specific')
  })

  it('returns null for no issue at all', () => {
    expect(messageFor(undefined)).toBe('(null)')
  })
})
