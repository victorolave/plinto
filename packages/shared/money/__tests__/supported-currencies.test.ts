import { describe, expect, it } from 'vitest'
import { minorUnitExponent } from '../currency'
import {
  CurrencyCodeSchema,
  SUPPORTED_CURRENCIES,
} from '../supported-currencies'

/**
 * The allow-list is a data-integrity boundary, not a convenience for the form.
 *
 * Before it, every currency field validated as `/^[A-Z]{3}$/`, so `XXX` and
 * `ABC` were accepted by the API. `minorUnitExponent` answers 2 for a code it
 * does not know and never throws, so a typo did not fail — it silently stored
 * and rendered amounts at the wrong scale, and COP, the default currency of a
 * Plinto household, has no decimals at all. These tests pin the boundary shut.
 */
describe('SUPPORTED_CURRENCIES', () => {
  it('contains COP — the Tenant default, so dropping it invalidates every new household', () => {
    expect(SUPPORTED_CURRENCIES).toContain('COP')
  })

  it.each(['USD', 'EUR'])(
    'contains %s — already present in stored data and fixtures, so the list must not orphan it',
    (currency) => {
      expect(SUPPORTED_CURRENCIES).toContain(currency)
    },
  )

  it('lists every code as three uppercase letters', () => {
    for (const currency of SUPPORTED_CURRENCIES) {
      expect(currency).toMatch(/^[A-Z]{3}$/)
    }
  })

  it('has no duplicates', () => {
    expect(new Set(SUPPORTED_CURRENCIES).size).toBe(SUPPORTED_CURRENCIES.length)
  })

  /**
   * A typo in the allow-list itself would be invisible: the schema would happily
   * accept the misspelling and reject the real code. Walking what the runtime
   * knows catches that at build time instead of at data-entry time.
   */
  it('lists only codes the runtime recognises as real currencies', () => {
    // `Intl.supportedValuesOf` is ES2022 and this package compiles against an
    // older lib, so it is reached through a local cast — the same accommodation
    // `currency.test.ts` makes rather than widening the package target.
    const known = new Set(
      (Intl as unknown as { supportedValuesOf(key: string): string[] }).supportedValuesOf(
        'currency',
      ),
    )
    for (const currency of SUPPORTED_CURRENCIES) {
      expect(known).toContain(currency)
    }
  })

  /**
   * The reason the list is closed. Every currency a user can pick must scale
   * correctly, which means the exponent table has to agree with CLDR for it —
   * not fall back to the two-decimal default.
   */
  it('scales every supported currency the way the runtime does', () => {
    for (const currency of SUPPORTED_CURRENCIES) {
      const intlDigits = new Intl.NumberFormat('en', {
        style: 'currency',
        currency,
      }).resolvedOptions().maximumFractionDigits
      expect(minorUnitExponent(currency)).toBe(intlDigits)
    }
  })

  it('covers both zero-decimal and two-decimal currencies, so the scale is exercised', () => {
    const exponents = new Set(SUPPORTED_CURRENCIES.map(minorUnitExponent))
    expect(exponents).toContain(0)
    expect(exponents).toContain(2)
  })
})

describe('CurrencyCodeSchema', () => {
  it.each(SUPPORTED_CURRENCIES)('accepts %s', (currency) => {
    expect(CurrencyCodeSchema.parse(currency)).toBe(currency)
  })

  /**
   * The exact bug being closed: these all satisfy the old `/^[A-Z]{3}$/`.
   */
  it.each(['XXX', 'ABC', 'ZZZ', 'QQQ'])(
    'rejects %s — three uppercase letters is not proof of a currency',
    (currency) => {
      expect(CurrencyCodeSchema.safeParse(currency).success).toBe(false)
    },
  )

  it.each(['cop', 'Usd', 'eUr'])(
    'rejects %s — the old contract required uppercase and narrowing must not widen it',
    (currency) => {
      expect(CurrencyCodeSchema.safeParse(currency).success).toBe(false)
    },
  )

  it.each(['CO', 'COPP', '', '123', 'C0P'])('rejects the malformed code %s', (currency) => {
    expect(CurrencyCodeSchema.safeParse(currency).success).toBe(false)
  })

  it('trims surrounding whitespace, as the create contracts did before', () => {
    expect(CurrencyCodeSchema.parse('  COP  ')).toBe('COP')
  })

  it('rejects a non-string', () => {
    expect(CurrencyCodeSchema.safeParse(42).success).toBe(false)
  })
})
