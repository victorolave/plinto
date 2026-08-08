import { describe, expect, it } from 'vitest'
import {
  CURRENCIES_WITH_NON_DEFAULT_MINOR_UNITS,
  DEFAULT_MINOR_UNIT_EXPONENT,
  minorUnitExponent,
  minorUnitScale,
  toMajorUnits,
  toMajorUnitsString,
  toMinorUnits,
} from '../currency'

describe('minorUnitExponent', () => {
  it('gives COP no decimals — the case this table exists for', () => {
    expect(minorUnitExponent('COP')).toBe(0)
  })

  it.each(['USD', 'EUR', 'ARS', 'MXN', 'BRL'])('gives %s two decimals', (currency) => {
    expect(minorUnitExponent(currency)).toBe(2)
  })

  it.each(['KWD', 'BHD', 'OMR', 'TND'])('gives %s three decimals', (currency) => {
    expect(minorUnitExponent(currency)).toBe(3)
  })

  it('accepts lowercase codes', () => {
    expect(minorUnitExponent('cop')).toBe(0)
    expect(minorUnitExponent('usd')).toBe(2)
  })

  // A bad currency code must not take down a page that is only rendering a
  // number, so this falls back instead of throwing.
  it.each([['ZZZ'], [''], [undefined as unknown as string]])(
    'falls back to the default for %p',
    (currency) => {
      expect(minorUnitExponent(currency)).toBe(DEFAULT_MINOR_UNIT_EXPONENT)
    },
  )
})

/**
 * The table is the source of truth, but it must not silently drift from CLDR.
 * `Intl` is the same data the formatter uses, so a mismatch here means an
 * amount would be divided by one scale and rendered with another — exactly the
 * class of bug this module was written to remove.
 */
describe('conformance with Intl (CLDR)', () => {
  // `maximumFractionDigits` is optional in the type even though a currency
  // formatter always resolves one; the fallback keeps the comparison honest
  // instead of silently comparing against undefined.
  const intlDigitsFor = (currency: string): number =>
    new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits ?? DEFAULT_MINOR_UNIT_EXPONENT

  it.each([...CURRENCIES_WITH_NON_DEFAULT_MINOR_UNITS])(
    'agrees with Intl for %s',
    (currency) => {
      expect(minorUnitExponent(currency)).toBe(intlDigitsFor(currency))
    },
  )

  it.each(['USD', 'EUR', 'GBP', 'ARS', 'MXN', 'BRL', 'CAD', 'CHF'])(
    'agrees with Intl for the default-scale currency %s',
    (currency) => {
      expect(minorUnitExponent(currency)).toBe(intlDigitsFor(currency))
    },
  )

  /**
   * The table has to be exhaustive, not representative. A currency CLDR scales
   * differently but this table omits would silently fall back to two decimals,
   * and an amount in it would be stored ×100 while rendered with none — the
   * original bug, narrowed to a currency nobody tested.
   *
   * Walks every code the runtime knows so a future CLDR update that reclassifies
   * a currency fails here instead of corrupting an amount.
   */
  it('covers every currency whose scale is not the default', () => {
    // `Intl.supportedValuesOf` is ES2022; this package compiles against an
    // older lib, so it is reached through a local cast rather than by widening
    // the whole package's target for one test.
    const knownCurrencies = (
      Intl as unknown as { supportedValuesOf(key: string): string[] }
    ).supportedValuesOf('currency')

    const missing = knownCurrencies
      .filter((currency: string) => intlDigitsFor(currency) !== DEFAULT_MINOR_UNIT_EXPONENT)
      .filter((currency: string) => !CURRENCIES_WITH_NON_DEFAULT_MINOR_UNITS.includes(currency))

    expect(missing).toEqual([])
  })

  /** The converse: nothing in the table that CLDR considers ordinary. */
  it('lists no currency that actually uses the default scale', () => {
    const spurious = CURRENCIES_WITH_NON_DEFAULT_MINOR_UNITS.filter(
      (currency) => intlDigitsFor(currency) === DEFAULT_MINOR_UNIT_EXPONENT,
    )

    expect(spurious).toEqual([])
  })
})

describe('minorUnitScale', () => {
  it.each([
    ['COP', 1],
    ['USD', 100],
    ['KWD', 1000],
  ])('scales %s by %i', (currency, expected) => {
    expect(minorUnitScale(currency)).toBe(expected)
  })
})

describe('toMinorUnits', () => {
  it('leaves a COP amount untouched — pesos are already the minor unit', () => {
    expect(toMinorUnits('2300000', 'COP')).toBe(2300000)
  })

  it('shifts a USD amount by two places', () => {
    expect(toMinorUnits('1234.50', 'USD')).toBe(123450)
    expect(toMinorUnits('0.07', 'USD')).toBe(7)
  })

  it('shifts a KWD amount by three places', () => {
    expect(toMinorUnits('1.234', 'KWD')).toBe(1234)
  })

  it('pads a short fraction', () => {
    expect(toMinorUnits('5.1', 'USD')).toBe(510)
    expect(toMinorUnits('5', 'USD')).toBe(500)
  })

  /**
   * The regression this function exists for. `1.005 * 100` is
   * 100.49999999999999 in binary floating point, so the old
   * `Math.round(amount * 100)` rounded it down to 100 and silently lost a cent.
   * Shifting digits as text cannot.
   *
   * Note which values break: `4.005 * 100` happens to land on exactly 400.5 and
   * rounds correctly. That is the danger — the old code was right often enough
   * to look correct, and wrong on inputs nobody thought to try.
   */
  it('does not lose a cent to binary floating point', () => {
    expect(Math.round(1.005 * 100)).toBe(100) // the old behaviour, for contrast
    expect(toMinorUnits('1.005', 'USD')).toBe(101)

    expect(toMinorUnits('4.005', 'USD')).toBe(401)
    expect(toMinorUnits('8.615', 'USD')).toBe(862)
  })

  it('rounds half-up on the first dropped digit', () => {
    expect(toMinorUnits('1.994', 'USD')).toBe(199)
    expect(toMinorUnits('1.995', 'USD')).toBe(200)
    // COP admits no decimals at all, so anything after the point is dropped.
    expect(toMinorUnits('2300000.4', 'COP')).toBe(2300000)
    expect(toMinorUnits('2300000.5', 'COP')).toBe(2300001)
  })

  it('handles negatives symmetrically', () => {
    expect(toMinorUnits('-12.34', 'USD')).toBe(-1234)
    expect(toMinorUnits('-2300000', 'COP')).toBe(-2300000)
  })

  it('accepts a leading or bare decimal point', () => {
    expect(toMinorUnits('.5', 'USD')).toBe(50)
    expect(toMinorUnits('12.', 'USD')).toBe(1200)
  })

  it('accepts numbers as well as strings', () => {
    expect(toMinorUnits(1234.5, 'USD')).toBe(123450)
    expect(toMinorUnits(2300000, 'COP')).toBe(2300000)
  })

  it('trims surrounding whitespace', () => {
    expect(toMinorUnits('  12.34  ', 'USD')).toBe(1234)
  })

  it.each(['', '   ', 'abc', '1,234.5', '1.2.3', '$5'])(
    'returns NaN for the unparseable input %p',
    (input) => {
      expect(toMinorUnits(input, 'USD')).toBeNaN()
    },
  )

  it('returns NaN for a non-finite number', () => {
    expect(toMinorUnits(Number.NaN, 'USD')).toBeNaN()
    expect(toMinorUnits(Number.POSITIVE_INFINITY, 'USD')).toBeNaN()
  })
})

describe('toMajorUnits', () => {
  it('is the identity for a currency with no minor unit', () => {
    expect(toMajorUnits(2300000, 'COP')).toBe(2300000)
  })

  it('divides by the currency scale', () => {
    expect(toMajorUnits(123450, 'USD')).toBe(1234.5)
    expect(toMajorUnits(1234, 'KWD')).toBe(1.234)
  })

  it('round-trips through toMinorUnits', () => {
    for (const [amount, currency] of [
      ['2300000', 'COP'],
      ['1234.50', 'USD'],
      ['1.234', 'KWD'],
    ] as const) {
      const minor = toMinorUnits(amount, currency)
      expect(toMajorUnitsString(minor, currency)).toBe(
        Number(amount).toFixed(minorUnitExponent(currency)),
      )
    }
  })
})

describe('toMajorUnitsString', () => {
  it('prints COP without a decimal point', () => {
    expect(toMajorUnitsString(2300000, 'COP')).toBe('2300000')
  })

  it('pads USD to two decimals', () => {
    expect(toMajorUnitsString(123450, 'USD')).toBe('1234.50')
    expect(toMajorUnitsString(7, 'USD')).toBe('0.07')
  })

  it('pads KWD to three decimals', () => {
    expect(toMajorUnitsString(1234, 'KWD')).toBe('1.234')
  })
})
