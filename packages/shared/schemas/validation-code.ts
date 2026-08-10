import type { ZodIssue } from 'zod'

/**
 * Stable identifiers for the cross-field rules this package enforces.
 *
 * ── Why these exist ──────────────────────────────────────────────────────
 * A `.refine()` used to carry only an English sentence. Both the API and the
 * web import these schemas, so the web had nothing stable to translate from
 * and keyed its Spanish off the English message *text*. Rewording a message
 * here silently dropped its translation back to English — nothing failed, no
 * test went red, and the only symptom was a Spanish-speaking user reading one
 * English line in an otherwise translated form.
 *
 * The code is the contract now. The message stays exactly as it was, byte for
 * byte, because it is what the API returns to non-browser clients — this
 * change is purely additive to that contract.
 *
 * A code is a promise: rename the constant and every consumer fails to
 * compile; add one without a translation and the web's catalogue test fails.
 * Neither is silent, which is the whole point.
 * ─────────────────────────────────────────────────────────────────────────
 */
export const VALIDATION_CODE = {
  /** A PATCH body arrived with every field undefined — nothing to update. */
  AT_LEAST_ONE_FIELD: 'AT_LEAST_ONE_FIELD',
  /** A transfer named the same account as source and destination. */
  ACCOUNTS_MUST_DIFFER: 'ACCOUNTS_MUST_DIFFER',
  /** An obligation's due date fell outside the period it is reported in. */
  DUE_DATE_INSIDE_PERIOD: 'DUE_DATE_INSIDE_PERIOD',
  /** A statement asked for more than its own closing balance. */
  DUE_WITHIN_BALANCE: 'DUE_WITHIN_BALANCE',
  /** The instalments already cover the principal; the last would be empty. */
  LAST_INSTALLMENT_EMPTY: 'LAST_INSTALLMENT_EMPTY',
} as const

export type ValidationCode = (typeof VALIDATION_CODE)[keyof typeof VALIDATION_CODE]

const CODES = new Set<string>(Object.values(VALIDATION_CODE))

export function isValidationCode(value: unknown): value is ValidationCode {
  return typeof value === 'string' && CODES.has(value)
}

/**
 * Reads the code back off an issue, or `null` for anything this package did
 * not tag — Zod's own built-ins (`too_small`, `invalid_type`, …) reach callers
 * untagged on purpose, since they are not ours to name.
 *
 * Lives here rather than in the web app so the two directions of the contract
 * cannot drift: whoever writes the code and whoever reads it share this file.
 */
export function validationCodeOf(issue: ZodIssue | undefined): ValidationCode | null {
  if (!issue || issue.code !== 'custom') return null

  const candidate = (issue.params as { code?: unknown } | undefined)?.code
  return isValidationCode(candidate) ? candidate : null
}

/**
 * The `params` payload to hand to `.refine()`. A function rather than an
 * inline object literal so every refinement tags itself the same way and a
 * typo is a type error.
 */
export function validationParams(code: ValidationCode): { code: ValidationCode } {
  return { code }
}
