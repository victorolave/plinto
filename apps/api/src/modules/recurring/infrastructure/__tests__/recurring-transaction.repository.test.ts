import { describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'
import { PrismaRecurringTransactionRepository } from '../prisma-recurring-transaction.repository'

const makePrisma = () => ({
  recurringTransactionRule: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
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
  status: 'active' as const,
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
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    prisma.recurringTransactionRule.create.mockResolvedValue(rule)
    const repository = new PrismaRecurringTransactionRepository(prisma as any)

    const result = await repository.createRule({
      tenantId: 'tenant-1',
      accountId: 'account-1',
      name: 'Monthly rent',
      type: 'expense',
      amountMinor: 250000,
      currency: 'COP',
      dayOfMonth: 5,
      startDate: new Date('2026-07-01T00:00:00.000Z'),
      status: 'active',
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
    const repository = new PrismaRecurringTransactionRepository(prisma as any)

    const result = await repository.listRulesByTenantId('tenant-1')

    expect(prisma.recurringTransactionRule.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        account: { archivedAt: null },
        status: { not: 'archived' },
      },
      orderBy: { createdAt: 'desc' },
    })
    expect(result).toEqual([{ id: 'rule-1' }])
  })

  it('includes archived rules only when explicitly requested', async () => {
    const prisma = makePrisma()
    prisma.recurringTransactionRule.findMany.mockResolvedValue([])
    const repository = new PrismaRecurringTransactionRepository(prisma as any)

    await repository.listRulesByTenantId('tenant-1', { includeArchived: true })

    const where = prisma.recurringTransactionRule.findMany.mock.calls[0][0].where
    expect(where.status).toBeUndefined()
    expect(where.tenantId).toBe('tenant-1')
  })

  it('excludes rules of archived accounts from the tenant listing', async () => {
    const prisma = makePrisma()
    prisma.recurringTransactionRule.findMany.mockResolvedValue([])
    const repository = new PrismaRecurringTransactionRepository(prisma as any)

    await repository.listRulesByTenantId('tenant-1')

    const where = prisma.recurringTransactionRule.findMany.mock.calls[0][0].where
    expect(where.account).toEqual({ archivedAt: null })
  })

  it('checks execution uniqueness by tenant and deterministic idempotency key', async () => {
    const prisma = makePrisma()
    prisma.recurringTransactionExecution.findUnique.mockResolvedValue({ id: 'exec-1' })
    const repository = new PrismaRecurringTransactionRepository(prisma as any)

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
    const repository = new PrismaRecurringTransactionRepository(prisma as any)

    const result = await repository.listActiveMonthlyRulesDueBy(
      new Date('2026-07-05T12:00:00.000Z'),
    )

    expect(prisma.recurringTransactionRule.findMany).toHaveBeenCalledWith({
      where: {
        status: 'active',
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
    const repository = new PrismaRecurringTransactionRepository(prisma as any)

    const result = await repository.listActiveMonthlyRulesDueBy(
      new Date('2026-07-21T00:00:00.000Z'),
    )

    expect(prisma.recurringTransactionRule.findMany).toHaveBeenCalledWith({
      where: {
        status: 'active',
        frequency: 'monthly',
        startDate: { lte: new Date('2026-07-21T00:00:00.000Z') },
        account: { archivedAt: null },
      },
      orderBy: { createdAt: 'asc' },
    })
    expect(result).toEqual([])
  })

  it('scopes a rule lookup to the tenant', async () => {
    const prisma = makePrisma()
    const rule = makeRule()
    prisma.recurringTransactionRule.findFirst.mockResolvedValue(rule)
    const repository = new PrismaRecurringTransactionRepository(prisma as any)

    const result = await repository.findRuleByIdForTenant('rule-1', 'tenant-1')

    expect(prisma.recurringTransactionRule.findFirst).toHaveBeenCalledWith({
      where: { id: 'rule-1', tenantId: 'tenant-1' },
    })
    expect(result).toBe(rule)
  })

  it('updates a rule with the tenant in the WHERE clause, not just the id', async () => {
    const prisma = makePrisma()
    const updated = makeRule({ amountMinor: 300000 })
    prisma.recurringTransactionRule.updateMany.mockResolvedValue({ count: 1 })
    prisma.recurringTransactionRule.findFirst.mockResolvedValue(updated)
    const repository = new PrismaRecurringTransactionRepository(prisma as any)

    const result = await repository.updateRuleForTenant('rule-1', 'tenant-1', {
      amountMinor: 300000,
    })

    expect(prisma.recurringTransactionRule.updateMany).toHaveBeenCalledWith({
      where: { id: 'rule-1', tenantId: 'tenant-1' },
      data: { amountMinor: 300000 },
    })
    expect(result).toBe(updated)
  })

  // A rule id belonging to another tenant must match zero rows rather than
  // mutating someone else's data — this is the tenant-isolation guarantee.
  it('returns null when updating a rule that is not in the tenant', async () => {
    const prisma = makePrisma()
    prisma.recurringTransactionRule.updateMany.mockResolvedValue({ count: 0 })
    const repository = new PrismaRecurringTransactionRepository(prisma as any)

    const result = await repository.updateRuleForTenant('rule-1', 'other-tenant', {
      name: 'Hijacked',
    })

    expect(result).toBeNull()
    expect(prisma.recurringTransactionRule.findFirst).not.toHaveBeenCalled()
  })

  it.each(['paused', 'active', 'archived'] as const)(
    'persists the %s lifecycle state scoped to the tenant',
    async (status) => {
      const prisma = makePrisma()
      const updated = makeRule({ status })
      prisma.recurringTransactionRule.updateMany.mockResolvedValue({ count: 1 })
      prisma.recurringTransactionRule.findFirst.mockResolvedValue(updated)
      const repository = new PrismaRecurringTransactionRepository(prisma as any)

      const result = await repository.setRuleStatusForTenant('rule-1', 'tenant-1', status)

      expect(prisma.recurringTransactionRule.updateMany).toHaveBeenCalledWith({
        where: { id: 'rule-1', tenantId: 'tenant-1' },
        data: { status },
      })
      expect(result).toBe(updated)
    },
  )

  it('returns null when moving the lifecycle of a rule that is not in the tenant', async () => {
    const prisma = makePrisma()
    prisma.recurringTransactionRule.updateMany.mockResolvedValue({ count: 0 })
    const repository = new PrismaRecurringTransactionRepository(prisma as any)

    const result = await repository.setRuleStatusForTenant(
      'rule-1',
      'other-tenant',
      'archived',
    )

    expect(result).toBeNull()
  })

  describe('listActiveMonthlyRulesForPeriod', () => {
    // Obligations are materialized ahead of time, so unlike the executor this
    // must not require the occurrence to have passed.
    it('takes every active rule that existed by the end of the period', async () => {
      const prisma = makePrisma()
      const rule = makeRule({ dayOfMonth: 5 })
      prisma.recurringTransactionRule.findMany.mockResolvedValue([rule])
      const repository = new PrismaRecurringTransactionRepository(prisma as any)

      const result = await repository.listActiveMonthlyRulesForPeriod('2026-07')

      expect(prisma.recurringTransactionRule.findMany).toHaveBeenCalledWith({
        where: {
          status: 'active',
          frequency: 'monthly',
          startDate: { lte: new Date('2026-07-31T23:59:59.999Z') },
          account: { archivedAt: null },
        },
        orderBy: { createdAt: 'asc' },
      })
      expect(result).toEqual([rule])
    })

    it('includes a rule whose occurrence is still in the future', async () => {
      const prisma = makePrisma()
      const rule = makeRule({
        dayOfMonth: 28,
        startDate: new Date('2026-01-01T00:00:00.000Z'),
      })
      prisma.recurringTransactionRule.findMany.mockResolvedValue([rule])
      const repository = new PrismaRecurringTransactionRepository(prisma as any)

      expect(await repository.listActiveMonthlyRulesForPeriod('2026-07')).toEqual([rule])
    })

    // A rule starting on the 20th owes nothing for a period whose occurrence
    // lands on the 5th.
    it('excludes a rule whose occurrence precedes its start date', async () => {
      const prisma = makePrisma()
      prisma.recurringTransactionRule.findMany.mockResolvedValue([
        makeRule({ dayOfMonth: 5, startDate: new Date('2026-07-20T00:00:00.000Z') }),
      ])
      const repository = new PrismaRecurringTransactionRepository(prisma as any)

      expect(await repository.listActiveMonthlyRulesForPeriod('2026-07')).toEqual([])
    })
  })

  it('atomically creates transaction, execution, and job audit provenance', async () => {
    const prisma = makePrisma()
    const tx = makePrisma()
    tx.transaction.create.mockResolvedValue({ id: 'tx-1' })
    tx.recurringTransactionExecution.findUnique.mockResolvedValue(null)
    tx.recurringTransactionExecution.create.mockResolvedValue({ id: 'exec-1' })
    tx.auditEvent.create.mockResolvedValue({ id: 'audit-1' })
    prisma.$transaction.mockImplementation((callback) => callback(tx))
    const repository = new PrismaRecurringTransactionRepository(prisma as any)

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

  it('returns null when a concurrent execution wins the unique-constraint race (P2002)', async () => {
    const prisma = makePrisma()
    const tx = makePrisma()
    const uniqueConstraintError = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on the fields: (`tenant_id`,`idempotency_key`)',
      { code: 'P2002', clientVersion: '5.0.0' },
    )
    tx.transaction.create.mockResolvedValue({ id: 'tx-1' })
    tx.recurringTransactionExecution.create.mockRejectedValue(uniqueConstraintError)
    prisma.$transaction.mockImplementation((callback) => callback(tx))
    const repository = new PrismaRecurringTransactionRepository(prisma as any)

    const result = await repository.createExecutionTransaction({
      rule: makeRule(),
      period: '2026-07',
      idempotencyKey: 'recurring:rule-1:2026-07',
      occurredAt: new Date('2026-07-05T00:00:00.000Z'),
      jobId: 'job-1',
    })

    expect(result).toBeNull()
  })

  it('re-throws non-P2002 Prisma errors instead of swallowing them', async () => {
    const prisma = makePrisma()
    const tx = makePrisma()
    const otherError = new Prisma.PrismaClientKnownRequestError('Foreign key violation', {
      code: 'P2003',
      clientVersion: '5.0.0',
    })
    tx.transaction.create.mockResolvedValue({ id: 'tx-1' })
    tx.recurringTransactionExecution.create.mockRejectedValue(otherError)
    prisma.$transaction.mockImplementation((callback) => callback(tx))
    const repository = new PrismaRecurringTransactionRepository(prisma as any)

    await expect(
      repository.createExecutionTransaction({
        rule: makeRule(),
        period: '2026-07',
        idempotencyKey: 'recurring:rule-1:2026-07',
        occurredAt: new Date('2026-07-05T00:00:00.000Z'),
        jobId: 'job-1',
      }),
    ).rejects.toBe(otherError)
  })

  it('propagates audit failures so the Prisma transaction rolls back', async () => {
    const prisma = makePrisma()
    const tx = makePrisma()
    tx.transaction.create.mockResolvedValue({ id: 'tx-1' })
    tx.recurringTransactionExecution.create.mockResolvedValue({ id: 'exec-1' })
    tx.auditEvent.create.mockRejectedValue(new Error('audit failed'))
    prisma.$transaction.mockImplementation((callback) => callback(tx))
    const repository = new PrismaRecurringTransactionRepository(prisma as any)

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
