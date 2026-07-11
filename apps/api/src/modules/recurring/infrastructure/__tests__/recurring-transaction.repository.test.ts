import { describe, expect, it, vi } from 'vitest'
import { RecurringTransactionRepository } from '../recurring-transaction.repository'

const makePrisma = () => ({
  recurringTransactionRule: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  recurringTransactionExecution: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  transaction: {
    create: vi.fn(),
  },
  auditEvent: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
})

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

describe('RecurringTransactionRepository', () => {
  it('creates monthly rules with tenant, derived currency, and no transaction side effect', async () => {
    const prisma = makePrisma()
    const rule = {
      id: 'rule-1',
      tenantId: 'tenant-1',
      accountId: 'account-1',
      name: 'Monthly rent',
      type: 'expense',
      amountMinor: 250000,
      currency: 'COP',
      frequency: 'monthly',
      dayOfMonth: 5,
      startDate: new Date('2026-07-01T00:00:00.000Z'),
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    prisma.recurringTransactionRule.create.mockResolvedValue(rule)
    const repository = new RecurringTransactionRepository(prisma as any)

    const result = await repository.createRule({
      tenantId: 'tenant-1',
      accountId: 'account-1',
      name: 'Monthly rent',
      type: 'expense',
      amountMinor: 250000,
      currency: 'COP',
      dayOfMonth: 5,
      startDate: new Date('2026-07-01T00:00:00.000Z'),
      active: true,
    })

    expect(prisma.recurringTransactionRule.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        accountId: 'account-1',
        currency: 'COP',
        frequency: 'monthly',
      }),
    })
    expect(prisma.transaction.create).not.toHaveBeenCalled()
    expect(result).toBe(rule)
  })

  it('lists tenant rules without crossing tenant boundaries', async () => {
    const prisma = makePrisma()
    prisma.recurringTransactionRule.findMany.mockResolvedValue([{ id: 'rule-1' }])
    const repository = new RecurringTransactionRepository(prisma as any)

    const result = await repository.listRulesByTenantId('tenant-1')

    expect(prisma.recurringTransactionRule.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', account: { archivedAt: null } },
      orderBy: { createdAt: 'desc' },
    })
    expect(result).toEqual([{ id: 'rule-1' }])
  })

  it('excludes rules of archived accounts from the tenant listing', async () => {
    const prisma = makePrisma()
    prisma.recurringTransactionRule.findMany.mockResolvedValue([])
    const repository = new RecurringTransactionRepository(prisma as any)

    await repository.listRulesByTenantId('tenant-1')

    const where = prisma.recurringTransactionRule.findMany.mock.calls[0][0].where
    expect(where.account).toEqual({ archivedAt: null })
  })

  it('checks execution uniqueness by tenant and deterministic idempotency key', async () => {
    const prisma = makePrisma()
    prisma.recurringTransactionExecution.findUnique.mockResolvedValue({ id: 'exec-1' })
    const repository = new RecurringTransactionRepository(prisma as any)

    const result = await repository.findExecutionByKey(
      'tenant-1',
      'recurring:rule-1:2026-07',
    )

    expect(prisma.recurringTransactionExecution.findUnique).toHaveBeenCalledWith({
      where: {
        tenantId_idempotencyKey: {
          tenantId: 'tenant-1',
          idempotencyKey: 'recurring:rule-1:2026-07',
        },
      },
    })
    expect(result).toEqual({ id: 'exec-1' })
  })

  it('queries only active monthly rules due by the UTC date', async () => {
    const prisma = makePrisma()
    const rule = makeRule()
    prisma.recurringTransactionRule.findMany.mockResolvedValue([rule])
    const repository = new RecurringTransactionRepository(prisma as any)

    const result = await repository.listActiveMonthlyRulesDueBy(
      new Date('2026-07-05T12:00:00.000Z'),
    )

    expect(prisma.recurringTransactionRule.findMany).toHaveBeenCalledWith({
      where: {
        active: true,
        frequency: 'monthly',
        startDate: { lte: new Date('2026-07-05T12:00:00.000Z') },
        account: { archivedAt: null },
      },
      orderBy: { createdAt: 'asc' },
    })
    expect(result).toEqual([rule])
  })

  it('does not return current-period rules whose scheduled occurrence is before their start date', async () => {
    const prisma = makePrisma()
    const futureStartedRule = makeRule({
      startDate: new Date('2026-07-20T00:00:00.000Z'),
      dayOfMonth: 5,
    })
    prisma.recurringTransactionRule.findMany.mockResolvedValue([futureStartedRule])
    const repository = new RecurringTransactionRepository(prisma as any)

    const result = await repository.listActiveMonthlyRulesDueBy(
      new Date('2026-07-21T00:00:00.000Z'),
    )

    expect(prisma.recurringTransactionRule.findMany).toHaveBeenCalledWith({
      where: {
        active: true,
        frequency: 'monthly',
        startDate: { lte: new Date('2026-07-21T00:00:00.000Z') },
        account: { archivedAt: null },
      },
      orderBy: { createdAt: 'asc' },
    })
    expect(result).toEqual([])
  })

  it('atomically creates transaction, execution, and job audit provenance', async () => {
    const prisma = makePrisma()
    const tx = makePrisma()
    tx.transaction.create.mockResolvedValue({ id: 'tx-1' })
    tx.recurringTransactionExecution.findUnique.mockResolvedValue(null)
    tx.recurringTransactionExecution.create.mockResolvedValue({ id: 'exec-1' })
    tx.auditEvent.create.mockResolvedValue({ id: 'audit-1' })
    prisma.$transaction.mockImplementation((callback) => callback(tx))
    const repository = new RecurringTransactionRepository(prisma as any)

    const result = await repository.createExecutionTransaction({
      rule: makeRule(),
      period: '2026-07',
      idempotencyKey: 'recurring:rule-1:2026-07',
      occurredAt: new Date('2026-07-05T00:00:00.000Z'),
      jobId: 'job-1',
    })

    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(tx.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        source: 'job',
        recurringRuleId: 'rule-1',
        recurringPeriod: '2026-07',
        idempotencyKey: 'recurring:rule-1:2026-07',
      }),
    })
    expect(tx.recurringTransactionExecution.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        period: '2026-07',
        idempotencyKey: 'recurring:rule-1:2026-07',
        transactionId: 'tx-1',
        jobId: 'job-1',
      }),
    })
    expect(tx.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: null,
        source: 'job',
        correlationId: 'job-1',
        metadata: expect.objectContaining({
          recurringRuleId: 'rule-1',
          recurringPeriod: '2026-07',
        }),
      }),
    })
    expect(result).toEqual({ transaction: { id: 'tx-1' }, execution: { id: 'exec-1' } })
  })

  it('propagates audit failures so the Prisma transaction rolls back', async () => {
    const prisma = makePrisma()
    const tx = makePrisma()
    tx.transaction.create.mockResolvedValue({ id: 'tx-1' })
    tx.recurringTransactionExecution.create.mockResolvedValue({ id: 'exec-1' })
    tx.auditEvent.create.mockRejectedValue(new Error('audit failed'))
    prisma.$transaction.mockImplementation((callback) => callback(tx))
    const repository = new RecurringTransactionRepository(prisma as any)

    await expect(
      repository.createExecutionTransaction({
        rule: makeRule(),
        period: '2026-07',
        idempotencyKey: 'recurring:rule-1:2026-07',
        occurredAt: new Date('2026-07-05T00:00:00.000Z'),
      }),
    ).rejects.toThrow('audit failed')
  })
})
