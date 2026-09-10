import { describe, expect, it } from 'vitest'
import {
  DEMO_INCOME_LABELS,
  buildDemoHouseholdDataset,
  validateDemoHouseholdDataset,
} from '../demo-household-dataset'

// Fixed "now" used across most assertions — day 2 so the sparse current
// month includes both of its transactions, mirroring the reference seed
// script's TODAY (2026-09-02).
const NOW = new Date(Date.UTC(2026, 8, 2, 12, 0, 0))

/**
 * A short denylist of things this dataset must never contain: real employer
 * names and people's names are unknown to this codebase by design, so this
 * only guards against the two concrete things the maintainer called out —
 * card holders must read "titular N", never a person's name, and nothing
 * should carry a private-sounding surname pattern used elsewhere in the
 * codebase's fixtures.
 */
const FORBIDDEN_SUBSTRINGS = ['Olave', 'Olaves', 'Victor']

function allStrings(dataset: ReturnType<typeof buildDemoHouseholdDataset>): string[] {
  return [
    ...dataset.accounts.map((a) => a.name),
    ...dataset.categories.map((c) => c.name),
    ...dataset.creditLines.map((c) => c.name),
    ...dataset.recurringRules.map((r) => r.name),
    ...dataset.manualObligations.map((m) => m.name),
    ...dataset.transactions.map((t) => t.description),
    ...dataset.transfers.map((t) => t.description),
    dataset.debtSchedule.name,
  ]
}

describe('buildDemoHouseholdDataset', () => {
  it('produces the expected counts for es locale', () => {
    const dataset = buildDemoHouseholdDataset(NOW, 'es')

    expect(dataset.accounts).toHaveLength(5)
    expect(dataset.categories).toHaveLength(14)
    expect(dataset.creditLines).toHaveLength(16)
    expect(dataset.creditLineStatements).toHaveLength(7)
    expect(dataset.recurringRules).toHaveLength(8)
    expect(dataset.manualObligations).toHaveLength(9)
    expect(dataset.transactions).toHaveLength(71)
    expect(dataset.transfers).toHaveLength(5)
    expect(dataset.obligationPayments).toHaveLength(7)
  })

  it('passes its own invariant validation for es and en', () => {
    expect(() => validateDemoHouseholdDataset(buildDemoHouseholdDataset(NOW, 'es'))).not.toThrow()
    expect(() => validateDemoHouseholdDataset(buildDemoHouseholdDataset(NOW, 'en'))).not.toThrow()
  })

  it('every statement satisfies the credit_line_statements CHECK constraints', () => {
    const dataset = buildDemoHouseholdDataset(NOW, 'es')

    for (const statement of dataset.creditLineStatements) {
      expect(statement.closingBalanceMinor).toBeGreaterThanOrEqual(0)
      expect(statement.amountDueMinor).toBeGreaterThanOrEqual(0)
      expect(statement.amountDueMinor).toBeLessThanOrEqual(statement.closingBalanceMinor)
      expect(statement.dueDate.getTime()).toBeGreaterThanOrEqual(statement.cutoffDate.getTime())
      expect(statement.limitMinorSnapshot).toBeGreaterThanOrEqual(0)
    }
  })

  it('credit line limits are round generic numbers between 1,000,000 and 4,000,000', () => {
    const dataset = buildDemoHouseholdDataset(NOW, 'es')

    for (const line of dataset.creditLines) {
      expect(line.limitMinor % 1_000_000).toBe(0)
      expect(line.limitMinor).toBeGreaterThanOrEqual(1_000_000)
      expect(line.limitMinor).toBeLessThanOrEqual(4_000_000)
    }
  })

  it('every obligation payment references an expense transaction with matching currency', () => {
    const dataset = buildDemoHouseholdDataset(NOW, 'es')
    const txByKey = new Map(dataset.transactions.map((t) => [t.key, t]))

    expect(dataset.obligationPayments.length).toBeGreaterThan(0)
    for (const payment of dataset.obligationPayments) {
      const tx = txByKey.get(payment.transactionKey)
      expect(tx).toBeDefined()
      expect(tx?.type).toBe('expense')
      // Single-currency dataset: every row shares dataset.currency (COP).
      expect(dataset.currency).toBe('COP')
    }

    // A transaction settles at most one obligation.
    const seen = new Set<string>()
    for (const payment of dataset.obligationPayments) {
      expect(seen.has(payment.transactionKey)).toBe(false)
      seen.add(payment.transactionKey)
    }
  })

  it('the current calendar month has at least one pending (unpaid, due-this-month) obligation', () => {
    const dataset = buildDemoHouseholdDataset(NOW, 'es')
    const paid = new Set(dataset.obligationPayments.map((p) => p.obligationKey))

    const dueThisMonth = (dueDate: Date) =>
      dueDate.getUTCFullYear() === NOW.getUTCFullYear() && dueDate.getUTCMonth() === NOW.getUTCMonth()

    const obligationsDueThisMonth = [
      ...dataset.manualObligations
        .filter((m) => dueThisMonth(m.dueDate))
        .map((m) => ({ key: m.key })),
      ...dataset.creditLineStatements
        .filter((s) => dueThisMonth(s.dueDate))
        .map((s) => ({ key: s.obligationKey })),
    ]

    expect(obligationsDueThisMonth.length).toBeGreaterThan(0)
    expect(obligationsDueThisMonth.some((o) => !paid.has(o.key))).toBe(true)
  })

  it('every transaction category type matches the transaction type', () => {
    const dataset = buildDemoHouseholdDataset(NOW, 'es')
    const categoryByKey = new Map(dataset.categories.map((c) => [c.key, c]))

    for (const tx of dataset.transactions) {
      if (!tx.categoryKey) continue
      const category = categoryByKey.get(tx.categoryKey)
      expect(category).toBeDefined()
      expect(category?.type).toBe(tx.type)
    }
  })

  it('the debt schedule is attached to a liability account', () => {
    const dataset = buildDemoHouseholdDataset(NOW, 'es')
    const account = dataset.accounts.find((a) => a.key === dataset.debtSchedule.accountKey)

    expect(account).toBeDefined()
    expect(['debt', 'credit']).toContain(account?.type)
  })

  it('is deterministic: the same `now` always produces a deep-equal dataset', () => {
    const first = buildDemoHouseholdDataset(new Date(NOW.getTime()), 'es')
    const second = buildDemoHouseholdDataset(new Date(NOW.getTime()), 'es')

    expect(second).toEqual(first)
  })

  it('never uses Date.now() or randomness — two different `now` values produce different dates', () => {
    const laterNow = new Date(Date.UTC(2026, 9, 2, 12, 0, 0)) // one month later
    const first = buildDemoHouseholdDataset(NOW, 'es')
    const second = buildDemoHouseholdDataset(laterNow, 'es')

    expect(first.recurringRules[0].startDate.getTime()).not.toBe(second.recurringRules[0].startDate.getTime())
  })

  it('the current (sparse) month only includes transactions on or before `now`', () => {
    const earlyNow = new Date(Date.UTC(2026, 8, 1, 12, 0, 0)) // day 1: only the day-1 tx should appear
    const dataset = buildDemoHouseholdDataset(earlyNow, 'es')

    const currentMonthTx = dataset.transactions.filter(
      (t) =>
        t.occurredAt.getUTCFullYear() === earlyNow.getUTCFullYear() &&
        t.occurredAt.getUTCMonth() === earlyNow.getUTCMonth(),
    )
    expect(currentMonthTx.every((t) => t.occurredAt.getTime() <= earlyNow.getTime())).toBe(true)
  })

  it('pins the income labels to the maintainer-specified literal strings', () => {
    const dataset = buildDemoHouseholdDataset(NOW, 'es')
    const incomeDescriptions = dataset.transactions
      .filter((t) => t.type === 'income' && !t.transferKey)
      .map((t) => t.description)

    expect(incomeDescriptions).toContain('Nómina mensual')
    expect(incomeDescriptions).toContain('Honorarios consultoría')
    expect(DEMO_INCOME_LABELS.payroll).toBe('Nómina mensual')
    expect(DEMO_INCOME_LABELS.consultingFees).toBe('Honorarios consultoría')
  })

  it('never contains a forbidden name from the denylist, in es or en', () => {
    for (const locale of ['es', 'en'] as const) {
      const dataset = buildDemoHouseholdDataset(NOW, locale)
      for (const value of allStrings(dataset)) {
        for (const forbidden of FORBIDDEN_SUBSTRINGS) {
          expect(value).not.toContain(forbidden)
        }
      }
    }
  })

  it('labels card-holder credit lines as "titular 1" / "titular 2" regardless of locale', () => {
    for (const locale of ['es', 'en'] as const) {
      const dataset = buildDemoHouseholdDataset(NOW, locale)
      const titularLines = dataset.creditLines.filter((l) => l.name.includes('titular'))
      expect(titularLines.length).toBeGreaterThan(0)
      for (const line of titularLines) {
        expect(/titular (1|2)/.test(line.name)).toBe(true)
      }
    }
  })

  it('produces English copy for en locale while keeping brand names unchanged', () => {
    const es = buildDemoHouseholdDataset(NOW, 'es')
    const en = buildDemoHouseholdDataset(NOW, 'en')

    expect(en.accounts.find((a) => a.key === 'efectivo')?.name).toBe('Cash')
    expect(es.accounts.find((a) => a.key === 'efectivo')?.name).toBe('Efectivo')

    // Brands unchanged across locales.
    for (const brand of ['ADDI', 'Nu', 'Rappi']) {
      expect(en.creditLines.some((l) => l.name.includes(brand))).toBe(true)
      expect(es.creditLines.some((l) => l.name.includes(brand))).toBe(true)
    }
  })
})
