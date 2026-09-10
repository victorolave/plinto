import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ObligationGenerationService } from '../obligation-generation.service'

const makeRule = (overrides = {}) => ({
  id: 'rule-1',
  tenantId: 'tenant-1',
  accountId: 'account-1',
  name: 'Rent',
  type: 'expense' as const,
  amountMinor: 230000,
  currency: 'COP',
  frequency: 'monthly' as const,
  dayOfMonth: 5,
  startDate: new Date('2026-01-01T00:00:00.000Z'),
  status: 'active' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

/** A fridge on six installments, first one due 2026-07-15. */
const makeSchedule = (overrides = {}) => ({
  id: 'schedule-1',
  tenantId: 'tenant-1',
  accountId: 'account-addi',
  name: 'Nevera',
  principalMinor: 600000,
  installmentMinor: 100000,
  installmentCount: 6,
  firstDueDate: new Date('2026-07-15T00:00:00.000Z'),
  currency: 'COP',
  status: 'active' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

describe('ObligationGenerationService', () => {
  let obligationRepository: {
    listGeneratedRuleIdsForPeriod: ReturnType<typeof vi.fn>
    listGeneratedScheduleIdsForPeriod: ReturnType<typeof vi.fn>
    createGeneratedInstance: ReturnType<typeof vi.fn>
    createGeneratedInstanceForSchedule: ReturnType<typeof vi.fn>
  }
  let recurringRepository: {
    listActiveMonthlyExpenseRulesForPeriod: ReturnType<typeof vi.fn>
  }
  let debtScheduleRepository: {
    listActiveForGeneration: ReturnType<typeof vi.fn>
  }
  let service: ObligationGenerationService

  beforeEach(() => {
    obligationRepository = {
      listGeneratedRuleIdsForPeriod: vi.fn().mockResolvedValue([]),
      listGeneratedScheduleIdsForPeriod: vi.fn().mockResolvedValue([]),
      createGeneratedInstance: vi.fn().mockResolvedValue({ id: 'obligation-1' }),
      createGeneratedInstanceForSchedule: vi
        .fn()
        .mockResolvedValue({ id: 'obligation-2' }),
    }
    recurringRepository = {
      listActiveMonthlyExpenseRulesForPeriod: vi.fn().mockResolvedValue([]),
    }
    debtScheduleRepository = {
      listActiveForGeneration: vi.fn().mockResolvedValue([]),
    }
    service = new ObligationGenerationService(
      obligationRepository as any,
      recurringRepository as any,
      debtScheduleRepository as any,
    )
  })

  it('materializes an instance per active rule, snapshotting the rule amount', async () => {
    recurringRepository.listActiveMonthlyExpenseRulesForPeriod.mockResolvedValue([makeRule()])

    const result = await service.generate({ period: '2026-07' })

    expect(obligationRepository.createGeneratedInstance).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      sourceType: 'recurring_rule',
      recurringRuleId: 'rule-1',
      period: '2026-07',
      dueDate: new Date('2026-07-05T00:00:00.000Z'),
      name: 'Rent',
      expectedAmountMinor: 230000,
      currency: 'COP',
    })
    expect(result).toEqual({ created: 1, skipped: 0, periods: ['2026-07'] })
  })

  // Re-running a period must never duplicate an obligation.
  it('skips rules already materialized for the period', async () => {
    recurringRepository.listActiveMonthlyExpenseRulesForPeriod.mockResolvedValue([makeRule()])
    obligationRepository.listGeneratedRuleIdsForPeriod.mockResolvedValue(['rule-1'])

    const result = await service.generate({ period: '2026-07' })

    expect(obligationRepository.createGeneratedInstance).not.toHaveBeenCalled()
    expect(result).toEqual({ created: 0, skipped: 1, periods: ['2026-07'] })
  })

  // A concurrent run that won the unique index is the same outcome as finding
  // the instance in the pre-check: skipped, never an error.
  it('counts a duplicate-signal (null) result as skipped, not created', async () => {
    recurringRepository.listActiveMonthlyExpenseRulesForPeriod.mockResolvedValue([makeRule()])
    obligationRepository.createGeneratedInstance.mockResolvedValue(null)

    const result = await service.generate({ period: '2026-07' })

    expect(result).toEqual({ created: 0, skipped: 1, periods: ['2026-07'] })
  })

  it('generates a forward projection across the horizon', async () => {
    recurringRepository.listActiveMonthlyExpenseRulesForPeriod.mockResolvedValue([makeRule()])

    const result = await service.generate({ period: '2026-11', horizonMonths: 3 })

    expect(result.periods).toEqual(['2026-11', '2026-12', '2027-01'])
    expect(result.created).toBe(3)
    expect(
      obligationRepository.createGeneratedInstance.mock.calls.map(([input]) => input.period),
    ).toEqual(['2026-11', '2026-12', '2027-01'])
  })

  it('defaults to the current period when none is given', async () => {
    await service.generate({ now: new Date('2026-07-20T12:00:00.000Z') })

    expect(recurringRepository.listActiveMonthlyExpenseRulesForPeriod).toHaveBeenCalledWith(
      '2026-07',
    )
  })

  it('due dates follow each rule day of month', async () => {
    recurringRepository.listActiveMonthlyExpenseRulesForPeriod.mockResolvedValue([
      makeRule({ id: 'rule-1', dayOfMonth: 5 }),
      makeRule({ id: 'rule-2', dayOfMonth: 28, name: 'Utilities' }),
    ])

    await service.generate({ period: '2026-07' })

    expect(
      obligationRepository.createGeneratedInstance.mock.calls.map(([input]) => input.dueDate),
    ).toEqual([
      new Date('2026-07-05T00:00:00.000Z'),
      new Date('2026-07-28T00:00:00.000Z'),
    ])
  })

  // The job runs across tenants, so the already-generated lookup must be asked
  // per tenant — asking once would leak one household's state onto another's.
  it('checks existing instances per tenant', async () => {
    recurringRepository.listActiveMonthlyExpenseRulesForPeriod.mockResolvedValue([
      makeRule({ id: 'rule-1', tenantId: 'tenant-1' }),
      makeRule({ id: 'rule-2', tenantId: 'tenant-2' }),
    ])

    await service.generate({ period: '2026-07' })

    expect(obligationRepository.listGeneratedRuleIdsForPeriod).toHaveBeenCalledWith(
      'tenant-1',
      '2026-07',
    )
    expect(obligationRepository.listGeneratedRuleIdsForPeriod).toHaveBeenCalledWith(
      'tenant-2',
      '2026-07',
    )
    expect(obligationRepository.listGeneratedRuleIdsForPeriod).toHaveBeenCalledTimes(2)
  })

  it('keeps each instance under the tenant of its own rule', async () => {
    recurringRepository.listActiveMonthlyExpenseRulesForPeriod.mockResolvedValue([
      makeRule({ id: 'rule-1', tenantId: 'tenant-1' }),
      makeRule({ id: 'rule-2', tenantId: 'tenant-2' }),
    ])

    await service.generate({ period: '2026-07' })

    expect(
      obligationRepository.createGeneratedInstance.mock.calls.map(([input]) => [
        input.recurringRuleId,
        input.tenantId,
      ]),
    ).toEqual([
      ['rule-1', 'tenant-1'],
      ['rule-2', 'tenant-2'],
    ])
  })

  it('reports nothing generated when no rule is active', async () => {
    const result = await service.generate({ period: '2026-07' })

    expect(result).toEqual({ created: 0, skipped: 0, periods: ['2026-07'] })
  })

  /**
   * The property a recurring rule cannot express, and the reason a financed
   * purchase is not one: a plan has a length.
   */
  describe('debt schedules', () => {
    it('materializes the installment that falls in the period', async () => {
      debtScheduleRepository.listActiveForGeneration.mockResolvedValue([makeSchedule()])

      const result = await service.generate({ period: '2026-07' })

      expect(obligationRepository.createGeneratedInstanceForSchedule).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        sourceType: 'debt_schedule',
        recurringRuleId: null,
        debtScheduleId: 'schedule-1',
        period: '2026-07',
        dueDate: new Date('2026-07-15T00:00:00.000Z'),
        name: 'Nevera — 1 of 6',
        expectedAmountMinor: 100000,
        currency: 'COP',
      })
      expect(result.created).toBe(1)
    })

    it('names the installment by its position, so a board can tell it apart', async () => {
      debtScheduleRepository.listActiveForGeneration.mockResolvedValue([makeSchedule()])

      await service.generate({ period: '2026-09' })

      expect(obligationRepository.createGeneratedInstanceForSchedule).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Nevera — 3 of 6', period: '2026-09' }),
      )
    })

    it('produces nothing before the plan starts', async () => {
      debtScheduleRepository.listActiveForGeneration.mockResolvedValue([makeSchedule()])

      const result = await service.generate({ period: '2026-06' })

      expect(obligationRepository.createGeneratedInstanceForSchedule).not.toHaveBeenCalled()
      // Not "skipped" either — there was never an obligation here to skip, and
      // counting one would report work that does not exist.
      expect(result).toEqual({ created: 0, skipped: 0, periods: ['2026-06'] })
    })

    it('stops after the last installment', async () => {
      debtScheduleRepository.listActiveForGeneration.mockResolvedValue([makeSchedule()])

      const result = await service.generate({ period: '2027-01' })

      expect(obligationRepository.createGeneratedInstanceForSchedule).not.toHaveBeenCalled()
      expect(result.created).toBe(0)
    })

    it('generates exactly installmentCount obligations across a long horizon', async () => {
      debtScheduleRepository.listActiveForGeneration.mockResolvedValue([makeSchedule()])

      const result = await service.generate({ period: '2026-07', horizonMonths: 12 })

      expect(obligationRepository.createGeneratedInstanceForSchedule).toHaveBeenCalledTimes(6)
      expect(result.created).toBe(6)
    })

    /**
     * Lenders quote figures that do not multiply out. One row of the source
     * sheet charges 4 × 59,505 against a credit of 238,023 — three pesos short.
     * The last installment absorbs the difference so the plan sums to exactly
     * its principal, rather than quietly disagreeing with the lender.
     */
    it('lets the last installment absorb what the others did not cover', async () => {
      debtScheduleRepository.listActiveForGeneration.mockResolvedValue([
        makeSchedule({ principalMinor: 238023, installmentMinor: 59505, installmentCount: 4 }),
      ])

      await service.generate({ period: '2026-07', horizonMonths: 6 })

      const amounts = obligationRepository.createGeneratedInstanceForSchedule.mock.calls.map(
        (call) => call[0].expectedAmountMinor,
      )

      expect(amounts).toEqual([59505, 59505, 59505, 59508])
      expect(amounts.reduce((sum, value) => sum + value, 0)).toBe(238023)
    })

    it('skips a period it already materialized, rather than duplicating it', async () => {
      debtScheduleRepository.listActiveForGeneration.mockResolvedValue([makeSchedule()])
      obligationRepository.listGeneratedScheduleIdsForPeriod.mockResolvedValue(['schedule-1'])

      const result = await service.generate({ period: '2026-07' })

      expect(obligationRepository.createGeneratedInstanceForSchedule).not.toHaveBeenCalled()
      expect(result).toEqual({ created: 0, skipped: 1, periods: ['2026-07'] })
    })

    // A concurrent run won the race against the unique index. Already
    // generated, not an error.
    it('treats a lost race as already generated', async () => {
      debtScheduleRepository.listActiveForGeneration.mockResolvedValue([makeSchedule()])
      obligationRepository.createGeneratedInstanceForSchedule.mockResolvedValue(null)

      const result = await service.generate({ period: '2026-07' })

      expect(result).toEqual({ created: 0, skipped: 1, periods: ['2026-07'] })
    })

    /**
     * A first payment on the 31st must not skip February nor spill into March
     * and land in the wrong period — the same cap recurring rules apply.
     */
    it('caps the due day at 28 so no installment lands outside its period', async () => {
      debtScheduleRepository.listActiveForGeneration.mockResolvedValue([
        makeSchedule({ firstDueDate: new Date('2026-07-31T00:00:00.000Z') }),
      ])

      await service.generate({ period: '2026-07' })

      expect(obligationRepository.createGeneratedInstanceForSchedule).toHaveBeenCalledWith(
        expect.objectContaining({ dueDate: new Date('2026-07-28T00:00:00.000Z') }),
      )
    })

    // One scheduler call materializes both kinds (PRD-007).
    it('materializes rules and installments in the same run', async () => {
      recurringRepository.listActiveMonthlyExpenseRulesForPeriod.mockResolvedValue([makeRule()])
      debtScheduleRepository.listActiveForGeneration.mockResolvedValue([makeSchedule()])

      const result = await service.generate({ period: '2026-07' })

      expect(obligationRepository.createGeneratedInstance).toHaveBeenCalledTimes(1)
      expect(obligationRepository.createGeneratedInstanceForSchedule).toHaveBeenCalledTimes(1)
      expect(result.created).toBe(2)
    })
  })
})
