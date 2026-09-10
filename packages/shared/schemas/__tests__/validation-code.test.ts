import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  CreateCreditLineStatementSchema,
  CreateDebtScheduleSchema,
  CreateObligationSchema,
  CreateTransferSchema,
  UpdateAccountSchema,
  UpdateCategorySchema,
  UpdateCreditLineSchema,
  UpdateCreditLineStatementSchema,
  UpdateRecurringTransactionRuleSchema,
  UpdateTransactionSchema,
  VALIDATION_CODE,
  VALIDATION_MESSAGE,
  validationCodeOf,
  isValidationCode,
} from '../../index'

/**
 * Every cross-field rule in this package must tag its issue with a stable
 * code. The web translates from that code; before it existed, the web keyed
 * its Spanish off the English sentence, so rewording a message here dropped
 * the translation without failing anything.
 *
 * These tests are what makes that impossible now. If a refinement loses its
 * `params`, the assertion below goes red rather than a user quietly reading
 * English.
 */

/** Runs a schema against input it must reject, and returns the first issue. */
function firstIssue(schema: z.ZodTypeAny, input: unknown): z.ZodIssue {
  const result = schema.safeParse(input)
  expect(result.success, 'expected the schema to reject this input').toBe(false)
  return (result as z.SafeParseError<unknown>).error.issues[0]
}

const VALID_STATEMENT = {
  cutoffDate: '2026-08-12T00:00:00.000Z',
  dueDate: '2026-08-25T00:00:00.000Z',
  closingBalanceMinor: 100000,
  amountDueMinor: 100000,
}

describe('validation codes are attached to every refinement', () => {
  it.each([
    ['UpdateAccountSchema', UpdateAccountSchema, {}],
    ['UpdateCategorySchema', UpdateCategorySchema, {}],
    ['UpdateTransactionSchema', UpdateTransactionSchema, {}],
    ['UpdateRecurringTransactionRuleSchema', UpdateRecurringTransactionRuleSchema, {}],
    ['UpdateCreditLineSchema', UpdateCreditLineSchema, {}],
    ['UpdateCreditLineStatementSchema', UpdateCreditLineStatementSchema, {}],
  ])('%s tags an empty patch as AT_LEAST_ONE_FIELD', (_name, schema, input) => {
    expect(validationCodeOf(firstIssue(schema, input))).toBe(
      VALIDATION_CODE.AT_LEAST_ONE_FIELD,
    )
  })

  it('CreateTransferSchema tags a self-transfer as ACCOUNTS_MUST_DIFFER', () => {
    const issue = firstIssue(CreateTransferSchema, {
      sourceAccountId: 'account-1',
      destinationAccountId: 'account-1',
      sourceAmountMinor: 1000,
    })

    expect(validationCodeOf(issue)).toBe(VALIDATION_CODE.ACCOUNTS_MUST_DIFFER)
    // The path still points at the field the user can act on.
    expect(issue.path).toEqual(['destinationAccountId'])
  })

  it('CreateObligationSchema tags an out-of-period due date', () => {
    const issue = firstIssue(CreateObligationSchema, {
      name: 'Rent',
      period: '2026-08',
      dueDate: '2026-09-05T00:00:00.000Z',
      expectedAmountMinor: 100000,
      currency: 'COP',
    })

    expect(validationCodeOf(issue)).toBe(VALIDATION_CODE.DUE_DATE_INSIDE_PERIOD)
    expect(issue.path).toEqual(['dueDate'])
  })

  it('CreateCreditLineStatementSchema tags an amount above the balance', () => {
    const issue = firstIssue(CreateCreditLineStatementSchema, {
      ...VALID_STATEMENT,
      closingBalanceMinor: 100000,
      amountDueMinor: 100001,
    })

    expect(validationCodeOf(issue)).toBe(VALIDATION_CODE.DUE_WITHIN_BALANCE)
    expect(issue.path).toEqual(['amountDueMinor'])
  })

  it('CreateDebtScheduleSchema tags an unpayable last instalment', () => {
    const issue = firstIssue(CreateDebtScheduleSchema, {
      accountId: 'account-1',
      name: 'Fridge',
      principalMinor: 100000,
      installmentMinor: 100000,
      installmentCount: 2,
      firstDueDate: '2026-09-01T00:00:00.000Z',
      currency: 'COP',
    })

    expect(validationCodeOf(issue)).toBe(VALIDATION_CODE.LAST_INSTALLMENT_EMPTY)
    expect(issue.path).toEqual(['installmentMinor'])
  })
})

describe('one code, one English message', () => {
  /**
   * The API returns these sentences to clients that have no catalogue, so the
   * wording is a contract — and it must be the SAME wording everywhere a rule
   * applies. It was not: four schemas said "At least one field must be
   * provided" while two said "Provide at least one field to update" for the
   * identical rule, because the sentence was a string literal copied to six
   * call sites.
   *
   * `VALIDATION_MESSAGE` is the single source now, and this asserts that every
   * schema actually reads from it rather than reintroducing a literal.
   */
  it.each([
    ['UpdateAccountSchema', UpdateAccountSchema, {}, VALIDATION_CODE.AT_LEAST_ONE_FIELD],
    [
      'UpdateCreditLineSchema',
      UpdateCreditLineSchema,
      {},
      VALIDATION_CODE.AT_LEAST_ONE_FIELD,
    ],
    [
      'UpdateCreditLineStatementSchema',
      UpdateCreditLineStatementSchema,
      {},
      VALIDATION_CODE.AT_LEAST_ONE_FIELD,
    ],
    [
      'CreateObligationSchema',
      CreateObligationSchema,
      {
        name: 'Rent',
        period: '2026-08',
        dueDate: '2026-09-05T00:00:00.000Z',
        expectedAmountMinor: 100000,
        currency: 'COP',
      },
      VALIDATION_CODE.DUE_DATE_INSIDE_PERIOD,
    ],
  ])('%s carries the canonical message for its code', (_name, schema, input, code) => {
    expect(firstIssue(schema, input).message).toBe(VALIDATION_MESSAGE[code])
  })

  it('gives the same sentence to every schema sharing a code', () => {
    const messages = [UpdateAccountSchema, UpdateCreditLineSchema, UpdateCategorySchema]
      .map((schema) => firstIssue(schema, {}).message)
      .filter((message, index, all) => all.indexOf(message) === index)

    // Exactly one distinct sentence — the divergence this replaced.
    expect(messages).toEqual([VALIDATION_MESSAGE[VALIDATION_CODE.AT_LEAST_ONE_FIELD]])
  })

  it('declares a non-empty message for every code', () => {
    for (const code of Object.values(VALIDATION_CODE)) {
      expect(VALIDATION_MESSAGE[code], code).toBeTypeOf('string')
      expect(VALIDATION_MESSAGE[code], code).not.toBe('')
    }
  })
})

describe('validationCodeOf', () => {
  it('returns null for Zod built-ins, which are not ours to name', () => {
    const issue = firstIssue(z.object({ a: z.string() }), { a: 1 })

    expect(issue.code).toBe('invalid_type')
    expect(validationCodeOf(issue)).toBeNull()
  })

  it('returns null for a custom issue with no code, and for nothing at all', () => {
    const bare = firstIssue(
      z.string().refine(() => false, { message: 'untagged' }),
      'x',
    )

    expect(validationCodeOf(bare)).toBeNull()
    expect(validationCodeOf(undefined)).toBeNull()
  })

  it('rejects a params.code that is not one of ours', () => {
    const issue = firstIssue(
      z.string().refine(() => false, { message: 'x', params: { code: 'NOT_OURS' } }),
      'x',
    )

    expect(validationCodeOf(issue)).toBeNull()
  })
})

describe('isValidationCode', () => {
  it('accepts every declared code and nothing else', () => {
    for (const code of Object.values(VALIDATION_CODE)) {
      expect(isValidationCode(code)).toBe(true)
    }

    expect(isValidationCode('NOT_OURS')).toBe(false)
    expect(isValidationCode(undefined)).toBe(false)
    expect(isValidationCode(42)).toBe(false)
  })
})
