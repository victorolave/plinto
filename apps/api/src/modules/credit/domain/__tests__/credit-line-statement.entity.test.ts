import { describe, it, expect } from 'vitest'
import {
  availableMinor,
  periodOfCutoff,
  statementObligationName,
} from '../credit-line-statement.entity'

const statement = (overrides = {}) => ({
  id: 'stmt-1',
  tenantId: 'tenant-1',
  creditLineId: 'line-addi',
  period: '2026-07',
  cutoffDate: new Date('2026-07-12T00:00:00.000Z'),
  dueDate: new Date('2026-07-20T00:00:00.000Z'),
  closingBalanceMinor: 800000,
  amountDueMinor: 300000,
  limitMinorSnapshot: 1200000,
  currency: 'COP',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

describe('availableMinor', () => {
  it('is the ceiling at that cutoff minus what it declared owed', () => {
    expect(availableMinor(statement())).toBe(400000)
  })

  // Measured against the snapshot, never the line's current limit, so raising
  // the ceiling today cannot restate a figure already read.
  it('uses the snapshotted limit rather than any later one', () => {
    expect(availableMinor(statement({ limitMinorSnapshot: 500000 }))).toBe(-300000)
  })

  // Fees push real balances past the ceiling. Refusing to report it would
  // force the household to lie to the system about what already happened.
  it('goes negative when the balance exceeded the ceiling', () => {
    const over = statement({ closingBalanceMinor: 1300000 })

    expect(availableMinor(over)).toBe(-100000)
  })
})

describe('periodOfCutoff', () => {
  it('files a statement under the month its cutoff falls in', () => {
    expect(periodOfCutoff(new Date('2026-07-12T00:00:00.000Z'))).toBe('2026-07')
  })

  it('pads single-digit months', () => {
    expect(periodOfCutoff(new Date('2026-01-31T00:00:00.000Z'))).toBe('2026-01')
  })

  // UTC throughout, so a household in Bogotá and a job server in Frankfurt
  // agree on which month a late-evening cutoff belongs to.
  it('reads the cutoff in UTC', () => {
    expect(periodOfCutoff(new Date('2026-07-31T23:30:00.000Z'))).toBe('2026-07')
  })
})

describe('statementObligationName', () => {
  // A line may bill twice in one month. Two identical rows on the board would
  // leave the household unable to tell which one it had already paid.
  it('carries the cutoff so two statements in a month stay distinguishable', () => {
    const first = statementObligationName('ADDI', new Date('2026-07-12T00:00:00.000Z'))
    const second = statementObligationName('ADDI', new Date('2026-07-26T00:00:00.000Z'))

    expect(first).toBe('ADDI — statement 12/07')
    expect(second).toBe('ADDI — statement 26/07')
    expect(first).not.toBe(second)
  })
})
