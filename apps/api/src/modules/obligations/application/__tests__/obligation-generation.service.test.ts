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

describe('ObligationGenerationService', () => {
  let obligationRepository: {
    listGeneratedRuleIdsForPeriod: ReturnType<typeof vi.fn>
    createGeneratedInstance: ReturnType<typeof vi.fn>
  }
  let recurringRepository: {
    listActiveMonthlyExpenseRulesForPeriod: ReturnType<typeof vi.fn>
  }
  let service: ObligationGenerationService

  beforeEach(() => {
    obligationRepository = {
      listGeneratedRuleIdsForPeriod: vi.fn().mockResolvedValue([]),
      createGeneratedInstance: vi.fn().mockResolvedValue({ id: 'obligation-1' }),
    }
    recurringRepository = {
      listActiveMonthlyExpenseRulesForPeriod: vi.fn().mockResolvedValue([]),
    }
    service = new ObligationGenerationService(
      obligationRepository as any,
      recurringRepository as any,
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
})
