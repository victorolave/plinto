import { describe, expect, it } from 'vitest'
import { isLiabilityAccountType } from '@plinto/shared'
import type { AccountBalance } from '../../../transactions/services/transactions'

/**
 * The rule the dashboard and the accounts page both apply, tested once against
 * the shared classifier rather than twice against two copies of it.
 *
 * Netting a debt account into the same figure as a bank account changes what
 * that figure means — from "what we hold" to "what we are worth" — for a
 * household that never asked for the second one. The number on the dashboard
 * answers "do we make it to the end of the month", and net worth does not.
 */
function split(balances: AccountBalance[]): { held: number; owed: number } {
  let held = 0
  let owed = 0
  for (const balance of balances) {
    if (isLiabilityAccountType(balance.accountType)) {
      owed -= balance.balanceMinor
    } else {
      held += balance.balanceMinor
    }
  }
  return { held, owed }
}

const balance = (overrides: Partial<AccountBalance> = {}): AccountBalance => ({
  accountId: 'acc-1',
  accountName: 'Bancolombia',
  accountType: 'bank',
  currency: 'COP',
  balanceMinor: 2_000_000,
  ...overrides,
})

describe('assets and liabilities', () => {
  // Which types count as liabilities is owned and tested by @plinto/shared;
  // what is asserted here is the arithmetic that reads it.

  it('reports what is owed as a positive figure', () => {
    const { held, owed } = split([
      balance({ balanceMinor: 2_000_000 }),
      balance({ accountId: 'acc-2', accountType: 'debt', balanceMinor: -983_000 }),
    ])

    expect(held).toBe(2_000_000)
    expect(owed).toBe(983_000)
  })

  /**
   * The regression this guards. A single blind sum would report 1,017,000 —
   * a household that believes it holds a million pesos when it holds two and
   * owes one.
   */
  it('never nets a debt against cash', () => {
    const { held, owed } = split([
      balance({ balanceMinor: 2_000_000 }),
      balance({ accountId: 'acc-2', accountType: 'debt', balanceMinor: -983_000 }),
    ])

    expect(held).not.toBe(1_017_000)
    expect(held - owed).toBe(1_017_000) // net worth, available on request
  })

  it('leaves a household with no debt reporting nothing owed', () => {
    const { held, owed } = split([balance(), balance({ accountId: 'acc-2' })])

    expect(held).toBe(4_000_000)
    expect(owed).toBe(0)
  })

  it('keeps currencies apart from the classification question', () => {
    const cop = split([balance({ currency: 'COP' })])
    const usd = split([balance({ currency: 'USD', balanceMinor: 100_000 })])

    expect(cop.held).toBe(2_000_000)
    expect(usd.held).toBe(100_000)
  })
})
