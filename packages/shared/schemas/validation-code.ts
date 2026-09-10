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

/**
 * The English sentence each code carries.
 *
 * This is the API's wording — what non-browser clients read — so it lives in
 * one place rather than as a string literal repeated at each call site. It was
 * repeated before, and it drifted exactly as you would expect: four schemas
 * said "At least one field must be provided" while two said "Provide at least
 * one field to update" for the identical rule. Nobody decided that; it is just
 * what happens to copied prose.
 *
 * The frontend never reads this — it translates from the code. This exists for
 * clients that have no catalogue.
 */
export const VALIDATION_MESSAGE: Record<ValidationCode, string> = {
  [VALIDATION_CODE.AT_LEAST_ONE_FIELD]: 'At least one field must be provided',
  [VALIDATION_CODE.ACCOUNTS_MUST_DIFFER]: 'Source and destination accounts must differ',
  [VALIDATION_CODE.DUE_DATE_INSIDE_PERIOD]: 'dueDate must fall inside period',
  [VALIDATION_CODE.DUE_WITHIN_BALANCE]: 'The amount due cannot exceed the closing balance',
  [VALIDATION_CODE.LAST_INSTALLMENT_EMPTY]:
    'The installments already cover the whole principal; the last one would be empty',
}

/**
 * Everything a `.refine()` needs for one of our rules, in a single call.
 *
 * Passing the message and the params separately left three ways to get it
 * wrong: a message that no longer matched its code, a code with no message,
 * and a refinement that forgot `params` entirely and fell back to untranslated
 * English. One argument removes all three.
 *
 *     .refine(check, validationIssue(VALIDATION_CODE.AT_LEAST_ONE_FIELD))
 *     .refine(check, validationIssue(VALIDATION_CODE.DUE_WITHIN_BALANCE, ['amountDueMinor']))
 */
export function validationIssue(
  code: ValidationCode,
  path?: (string | number)[],
): { message: string; params: { code: ValidationCode }; path?: (string | number)[] } {
  return {
    message: VALIDATION_MESSAGE[code],
    params: validationParams(code),
    ...(path ? { path } : {}),
  }
}

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
