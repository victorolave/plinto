import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Amount, amountInputStep, formatMoneyMagnitude } from '../amount'

/** Strips the NO-BREAK SPACE `Intl` puts between a currency code and its digits. */
const plain = (value: string): string => value.replace(/\u00a0/g, ' ')

describe('formatMoneyMagnitude', () => {
  /**
   * The regression this file exists for. Every amount used to be divided by 100
   * and printed with two decimals, so 2.300.000 pesos rendered as
   * `$ 23.000,00` — off by a factor of a hundred AND showing a centavo that has
   * not circulated in decades.
   */
  it('renders COP whole, with no minor unit', () => {
    const formatted = plain(formatMoneyMagnitude(2300000, 'COP'))

    expect(formatted).toContain('2,300,000')
    expect(formatted).not.toContain('.00')
    expect(formatted).not.toContain('23,000')
  })

  it('still renders USD with two decimals', () => {
    expect(plain(formatMoneyMagnitude(123450, 'USD'))).toContain('1,234.50')
  })

  it('renders a three-decimal currency with three', () => {
    expect(plain(formatMoneyMagnitude(1234, 'KWD'))).toContain('1.234')
  })

  it('renders zero at the currency’s own scale', () => {
    expect(plain(formatMoneyMagnitude(0, 'COP'))).not.toContain('.')
    expect(plain(formatMoneyMagnitude(0, 'USD'))).toContain('0.00')
  })

  it('formats the magnitude, leaving the sign to the caller', () => {
    expect(formatMoneyMagnitude(-2300000, 'COP')).toBe(formatMoneyMagnitude(2300000, 'COP'))
  })

  /**
   * The divisor and the fraction digits must come from the same place. If they
   * ever diverge the figure is scaled by one and printed by the other, which
   * still looks like money — so this pins the relationship end to end.
   */
  it('divides and prints at the same scale', () => {
    for (const [minor, currency, expected] of [
      [2300000, 'COP', '2,300,000'],
      [123450, 'USD', '1,234.50'],
      [1234, 'KWD', '1.234'],
    ] as const) {
      expect(plain(formatMoneyMagnitude(minor, currency))).toContain(expected)
    }
  })

  // An unrecognised code must not throw: a page rendering a number should not
  // go blank because a currency was mistyped upstream.
  it('falls back to "CODE amount" for an unknown currency', () => {
    const formatted = plain(formatMoneyMagnitude(123450, 'ZZZ'))

    expect(formatted).toContain('ZZZ')
    expect(formatted).toContain('1,234.50')
  })
})

describe('amountInputStep', () => {
  it.each([
    ['COP', '1'],
    ['USD', '0.01'],
    ['KWD', '0.001'],
  ])('gives %s a step of %s', (currency, expected) => {
    expect(amountInputStep(currency)).toBe(expected)
  })
})

describe('Amount', () => {
  it('uses a true minus for negatives, not a hyphen', () => {
    render(<Amount minor={-2300000} currency="COP" />)

    const text = screen.getByText(/2,300,000/).textContent ?? ''
    expect(text.startsWith('−')).toBe(true)
    expect(text.startsWith('-')).toBe(false)
  })

  it('prefixes a positive with + only when asked', () => {
    const { rerender } = render(<Amount minor={2300000} currency="COP" />)
    expect(screen.getByText(/2,300,000/).textContent?.startsWith('+')).toBe(false)

    rerender(<Amount minor={2300000} currency="COP" showSign />)
    expect(screen.getByText(/2,300,000/).textContent?.startsWith('+')).toBe(true)
  })
})
