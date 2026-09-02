import { minorUnitExponent } from '@plinto/shared'

/**
 * Builds the `money.currencies` reference table for every currency actually
 * present in a household's data — not every currency Plinto knows about.
 * A restored dump should be self-describing without requiring the reader to
 * also ship `@plinto/shared`.
 */
export function buildCurrencyCatalogue(
  currencies: Iterable<string>,
): Record<string, { exponent: number }> {
  const distinct = Array.from(new Set(currencies)).sort()

  const catalogue: Record<string, { exponent: number }> = {}
  for (const currency of distinct) {
    catalogue[currency] = { exponent: minorUnitExponent(currency) }
  }

  return catalogue
}
