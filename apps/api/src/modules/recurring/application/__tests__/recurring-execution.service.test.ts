import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RecurringExecutionService } from '../recurring-execution.service'
import { RecurringTransactionRepository } from '../../infrastructure/recurring-transaction.repository'

const makeRule = (overrides = {}) => ({
  id: 'rule-1',
  tenantId: 'tenant-1',
  accountId: 'account-1',
  name: 'Monthly rent',
  type: 'expense' as const,
  amountMinor: 250000,
  currency: 'COP',
  frequency: 'monthly' as const,
  dayOfMonth: 5,
  startDate: new Date('2026-07-01T00:00:00.000Z'),
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

const makePrisma = () => ({
  recurringTransactionRule: {
    findMany: vi.fn(),
  },
  recurringTransactionExecution: {
    findUnique: vi.fn(),
  },
  transaction: {
    create: vi.fn(),
  },
  auditEvent: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
})

describe('RecurringExecutionService', () => {
  let repository: {
    listActiveMonthlyRulesDueBy: ReturnType<typeof vi.fn>
    findExecutionByKey: ReturnType<typeof vi.fn>
    createExecutionTransaction: ReturnType<typeof vi.fn>
  }
  let service: RecurringExecutionService

  beforeEach(() => {
    repository = {
      listActiveMonthlyRulesDueBy: vi.fn(),
      findExecutionByKey: vi.fn(),
      createExecutionTransaction: vi.fn(),
    }
    service = new RecurringExecutionService(repository as any)
  })

  it('executes due monthly rules with deterministic period idempotency keys', async () => {
    const rule = makeRule()
    repository.listActiveMonthlyRulesDueBy.mockResolvedValue([rule])
    repository.findExecutionByKey.mockResolvedValue(null)
    repository.createExecutionTransaction.mockResolvedValue({ transaction: { id: 'tx-1' }, execution: { id: 'exec-1' } })

    const result = await service.executeDue({ dueDate: '2026-07-05T12:00:00.000Z', jobId: 'job-1' })

    expect(repository.createExecutionTransaction).toHaveBeenCalledWith({
      rule,
      period: '2026-07',
      idempotencyKey: 'recurring:rule-1:2026-07',
      occurredAt: new Date('2026-07-05T00:00:00.000Z'),
      jobId: 'job-1',
    })
    expect(result).toEqual({ created: 1, skipped: 0 })
  })

  it('skips already executed rule periods', async () => {
    repository.listActiveMonthlyRulesDueBy.mockResolvedValue([makeRule()])
    repository.findExecutionByKey.mockResolvedValue({ id: 'exec-existing' })

    const result = await service.executeDue({ dueDate: '2026-07-05T00:00:00.000Z' })

    expect(repository.createExecutionTransaction).not.toHaveBeenCalled()
    expect(result).toEqual({ created: 0, skipped: 1 })
  })

  it('does not back-create a current-month occurrence before the rule start date', async () => {
    const prisma = makePrisma()
    prisma.recurringTransactionRule.findMany.mockResolvedValue([
      makeRule({
        startDate: new Date('2026-07-20T00:00:00.000Z'),
        dayOfMonth: 5,
      }),
    ])
    const realRepository = new RecurringTransactionRepository(prisma as any)
    const createExecutionTransaction = vi
      .spyOn(realRepository, 'createExecutionTransaction')
      .mockResolvedValue({ transaction: { id: 'tx-1' } as any, execution: { id: 'exec-1' } as any })
    const executionService = new RecurringExecutionService(realRepository)

    const result = await executionService.executeDue({
      dueDate: '2026-07-21T00:00:00.000Z',
      jobId: 'job-1',
    })

    expect(createExecutionTransaction).not.toHaveBeenCalled()
    expect(result).toEqual({ created: 0, skipped: 0 })
  })
})
