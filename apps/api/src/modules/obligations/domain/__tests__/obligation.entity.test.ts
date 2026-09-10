import { describe, expect, it } from 'vitest'
import {
  ObligationInstance,
  ObligationPayment,
  resolveObligationInstance,
  sumPaidAmountMinor,
} from '../obligation.entity'

const NOW = new Date('2026-07-20T00:00:00.000Z')

const makePayment = (overrides: Partial<ObligationPayment> = {}): ObligationPayment => ({
  id: 'payment-1',
  tenantId: 'tenant-1',
  obligationInstanceId: 'obligation-1',
  transactionId: 'tx-1',
  amountMinor: 100000,
  currency: 'COP',
  occurredAt: new Date('2026-07-05T00:00:00.000Z'),
  createdAt: new Date('2026-07-05T00:00:00.000Z'),
  ...overrides,
})

const makeInstance = (overrides: Partial<ObligationInstance> = {}): ObligationInstance => ({
  id: 'obligation-1',
  tenantId: 'tenant-1',
  sourceType: 'recurring_rule',
  recurringRuleId: 'rule-1',
  period: '2026-07',
  // Not yet due at NOW, so tests opt into overdue explicitly.
  dueDate: new Date('2026-07-25T00:00:00.000Z'),
  name: 'Rent',
  expectedAmountMinor: 230000,
  currency: 'COP',
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-01T00:00:00.000Z'),
  payments: [],
  ...overrides,
})

describe('resolveObligationInstance', () => {
  it('reports an unpaid, not-yet-due obligation as pending', () => {
    const result = resolveObligationInstance(makeInstance(), NOW)

    expect(result.status).toBe('pending')
    expect(result.paidAmountMinor).toBe(0)
    expect(result.outstandingAmountMinor).toBe(230000)
  })

  it('reports a partially paid obligation as partial with the remainder outstanding', () => {
    const result = resolveObligationInstance(
      makeInstance({ payments: [makePayment({ amountMinor: 100000 })] }),
      NOW,
    )

    expect(result.status).toBe('partial')
    expect(result.paidAmountMinor).toBe(100000)
    expect(result.outstandingAmountMinor).toBe(130000)
  })

  // Rent settled with two transfers — the case a single payment column could
  // not express.
  it('adds up several payments to settle one obligation', () => {
    const result = resolveObligationInstance(
      makeInstance({
        payments: [
          makePayment({ id: 'payment-1', transactionId: 'tx-1', amountMinor: 100000 }),
          makePayment({ id: 'payment-2', transactionId: 'tx-2', amountMinor: 130000 }),
        ],
      }),
      NOW,
    )

    expect(result.status).toBe('paid')
    expect(result.paidAmountMinor).toBe(230000)
    expect(result.outstandingAmountMinor).toBe(0)
  })

  it('reports an unpaid obligation past its due date as overdue', () => {
    const result = resolveObligationInstance(
      makeInstance({ dueDate: new Date('2026-07-05T00:00:00.000Z') }),
      NOW,
    )

    expect(result.status).toBe('overdue')
  })

  // A half-paid bill that is already late is a late bill: the urgency is what
  // the household needs to see, and the partial payment stays visible in
  // paidAmountMinor.
  it('prefers overdue over partial for a late, partially paid obligation', () => {
    const result = resolveObligationInstance(
      makeInstance({
        dueDate: new Date('2026-07-05T00:00:00.000Z'),
        payments: [makePayment({ amountMinor: 100000 })],
      }),
      NOW,
    )

    expect(result.status).toBe('overdue')
    expect(result.paidAmountMinor).toBe(100000)
  })

  // Paying late still settles the obligation; it must not read as overdue.
  it('reports a fully paid obligation as paid even past its due date', () => {
    const result = resolveObligationInstance(
      makeInstance({
        dueDate: new Date('2026-07-05T00:00:00.000Z'),
        payments: [makePayment({ amountMinor: 230000 })],
      }),
      NOW,
    )

    expect(result.status).toBe('paid')
  })

  // The surplus is a fact about the transaction, not about the obligation. A
  // negative outstanding would leak into the period totals and understate the
  // real shortfall of every other obligation.
  it('treats an overpayment as paid and floors the outstanding amount at zero', () => {
    const result = resolveObligationInstance(
      makeInstance({ payments: [makePayment({ amountMinor: 250000 })] }),
      NOW,
    )

    expect(result.status).toBe('paid')
    expect(result.paidAmountMinor).toBe(250000)
    expect(result.outstandingAmountMinor).toBe(0)
  })

  it('treats an obligation due exactly now as not yet overdue', () => {
    const result = resolveObligationInstance(makeInstance({ dueDate: NOW }), NOW)

    expect(result.status).toBe('pending')
  })

  it('preserves the instance fields it does not derive', () => {
    const instance = makeInstance({ sourceType: 'manual', recurringRuleId: null })

    const result = resolveObligationInstance(instance, NOW)

    expect(result.sourceType).toBe('manual')
    expect(result.recurringRuleId).toBeNull()
    expect(result.period).toBe('2026-07')
    expect(result.currency).toBe('COP')
  })
})

describe('sumPaidAmountMinor', () => {
  it('returns zero for an obligation with no payments', () => {
    expect(sumPaidAmountMinor([])).toBe(0)
  })

  it('adds every linked payment', () => {
    expect(
      sumPaidAmountMinor([
        makePayment({ amountMinor: 100000 }),
        makePayment({ amountMinor: 30000 }),
      ]),
    ).toBe(130000)
  })
})
