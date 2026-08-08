import { describe, expect, it } from 'vitest'
import {
  CreateObligationSchema,
  GenerateObligationsSchema,
  ObligationInstanceSchema,
  ObligationPeriodSchema,
  ObligationPeriodSummarySchema,
  ObligationSourceTypeSchema,
  ObligationStatusSchema,
  ReconcileObligationSchema,
} from '../obligation.schema'

const validCreateInput = {
  name: 'Income tax filing',
  period: '2026-07',
  dueDate: '2026-07-15T00:00:00.000Z',
  expectedAmountMinor: 120000000,
  currency: 'COP',
}

describe('obligation schemas', () => {
  describe('ObligationPeriodSchema', () => {
    it.each(['2026-01', '2026-12'])('accepts %s', (period) => {
      expect(ObligationPeriodSchema.parse(period)).toBe(period)
    })

    it.each(['2026-00', '2026-13', '2026-7', '26-07', '2026-07-01'])(
      'rejects %s',
      (period) => {
        expect(ObligationPeriodSchema.safeParse(period).success).toBe(false)
      },
    )
  })

  /**
   * `debt_schedule` was deliberately rejected here until PRD-007 existed — a
   * barrier so nobody could declare that origin before the model behind it did.
   * PRD-007 arrived, so the barrier inverts: the origin is now real, and the
   * database's CHECK constraint pins which reference it must carry.
   */
  it('recognises the origins an instance may declare', () => {
    expect(ObligationSourceTypeSchema.parse('recurring_rule')).toBe('recurring_rule')
    expect(ObligationSourceTypeSchema.parse('manual')).toBe('manual')
    expect(ObligationSourceTypeSchema.parse('debt_schedule')).toBe('debt_schedule')
  })

  it('still refuses an origin nothing produces', () => {
    expect(ObligationSourceTypeSchema.safeParse('imported').success).toBe(false)
  })

  it.each(['pending', 'partial', 'paid', 'overdue'])(
    'exposes %s as a reported state',
    (status) => {
      expect(ObligationStatusSchema.parse(status)).toBe(status)
    },
  )

  describe('CreateObligationSchema', () => {
    it('accepts a one-off obligation inside its period', () => {
      expect(CreateObligationSchema.parse(validCreateInput)).toEqual(validCreateInput)
    })

    // An obligation due outside its own period would be invisible in the month
    // that reports it and unaccounted for in the month it is actually due.
    it('rejects a due date that falls outside the declared period', () => {
      const result = CreateObligationSchema.safeParse({
        ...validCreateInput,
        dueDate: '2026-08-15T00:00:00.000Z',
      })

      expect(result.success).toBe(false)
    })

    it('rejects a non-positive expected amount', () => {
      const result = CreateObligationSchema.safeParse({
        ...validCreateInput,
        expectedAmountMinor: 0,
      })

      expect(result.success).toBe(false)
    })

    // Anything created through this contract is manual by construction.
    it('strips a caller-supplied source type', () => {
      const result = CreateObligationSchema.parse({
        ...validCreateInput,
        sourceType: 'recurring_rule',
      })

      expect('sourceType' in result).toBe(false)
    })
  })

  it('requires a transaction id to reconcile', () => {
    expect(ReconcileObligationSchema.parse({ transactionId: 'tx-1' })).toEqual({
      transactionId: 'tx-1',
    })
    expect(ReconcileObligationSchema.safeParse({ transactionId: '  ' }).success).toBe(false)
  })

  describe('GenerateObligationsSchema', () => {
    it('defaults to a single period when no horizon is given', () => {
      expect(GenerateObligationsSchema.parse({})).toEqual({ horizonMonths: 1 })
    })

    it('accepts a forward projection horizon', () => {
      const result = GenerateObligationsSchema.parse({
        period: '2026-07',
        horizonMonths: 3,
      })

      expect(result).toEqual({ period: '2026-07', horizonMonths: 3 })
    })

    it.each([0, 13])('rejects a horizon of %s months', (horizonMonths) => {
      expect(GenerateObligationsSchema.safeParse({ horizonMonths }).success).toBe(false)
    })
  })

  it('serializes an instance DTO with its derived state and payments', () => {
    const timestamp = '2026-07-01T00:00:00.000Z'

    const result = ObligationInstanceSchema.parse({
      id: 'obligation-1',
      tenantId: 'tenant-1',
      sourceType: 'recurring_rule',
      recurringRuleId: 'rule-1',
      period: '2026-07',
      dueDate: timestamp,
      name: 'Rent',
      expectedAmountMinor: 230000000,
      currency: 'COP',
      status: 'partial',
      paidAmountMinor: 100000000,
      outstandingAmountMinor: 130000000,
      payments: [
        {
          id: 'payment-1',
          transactionId: 'tx-1',
          amountMinor: 100000000,
          currency: 'COP',
          occurredAt: timestamp,
          createdAt: timestamp,
        },
      ],
      createdAt: timestamp,
      updatedAt: timestamp,
    })

    expect(result.status).toBe('partial')
    expect(result.payments).toHaveLength(1)
  })

  it('allows a one-off instance to carry no rule reference', () => {
    const timestamp = '2026-07-01T00:00:00.000Z'

    const result = ObligationInstanceSchema.parse({
      id: 'obligation-2',
      tenantId: 'tenant-1',
      sourceType: 'manual',
      recurringRuleId: null,
      period: '2026-07',
      dueDate: timestamp,
      name: 'Income tax filing',
      expectedAmountMinor: 120000000,
      currency: 'COP',
      status: 'pending',
      paidAmountMinor: 0,
      outstandingAmountMinor: 120000000,
      payments: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    })

    expect(result.recurringRuleId).toBeNull()
  })

  // Summing across currencies would be arithmetic on incomparable units.
  it('reports period totals as one row per currency', () => {
    const result = ObligationPeriodSummarySchema.parse({
      period: '2026-07',
      totals: [
        {
          currency: 'COP',
          expectedMinor: 230000000,
          paidMinor: 100000000,
          outstandingMinor: 130000000,
        },
        { currency: 'USD', expectedMinor: 50000, paidMinor: 0, outstandingMinor: 50000 },
      ],
    })

    expect(result.totals.map((total) => total.currency)).toEqual(['COP', 'USD'])
  })
})
