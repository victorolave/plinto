import { describe, expect, it } from 'vitest'
import { CreateCreditLineSchema } from '../credit-line.schema'

const validCreateInput = {
  name: 'Visa Bancolombia',
  limitMinor: 5000000,
  currency: 'COP',
}

/**
 * A credit line is created with a currency of its own rather than inheriting an
 * account's, so it is a second hand-entry point for a currency code and needs
 * the same allow-list the account form has.
 */
describe('CreateCreditLineSchema', () => {
  it('accepts a valid line', () => {
    expect(CreateCreditLineSchema.safeParse(validCreateInput).success).toBe(true)
  })

  it.each(['XXX', 'ABC', 'QQQ', 'cop'])('rejects the currency %s', (currency) => {
    const result = CreateCreditLineSchema.safeParse({ ...validCreateInput, currency })
    expect(result.success).toBe(false)
  })

  it.each(['COP', 'USD', 'EUR'])('accepts the supported currency %s', (currency) => {
    const result = CreateCreditLineSchema.safeParse({ ...validCreateInput, currency })
    expect(result.success).toBe(true)
  })

  it('trims surrounding whitespace on the currency', () => {
    const result = CreateCreditLineSchema.safeParse({
      ...validCreateInput,
      currency: '  USD  ',
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.currency).toBe('USD')
  })
})
