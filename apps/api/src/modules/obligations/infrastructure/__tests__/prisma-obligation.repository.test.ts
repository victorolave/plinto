import { describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'
import { PrismaObligationRepository } from '../prisma-obligation.repository'

const makePrisma = () => ({
  obligationInstance: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    groupBy: vi.fn(),
  },
  obligationPayment: {
    create: vi.fn(),
    findFirst: vi.fn(),
    deleteMany: vi.fn(),
  },
  transaction: {
    groupBy: vi.fn(),
  },
})

const makePrismaPayment = (overrides = {}) => ({
  id: 'payment-1',
  tenantId: 'tenant-1',
  obligationInstanceId: 'obligation-1',
  transactionId: 'tx-1',
  createdAt: new Date('2026-07-05T12:00:00.000Z'),
  transaction: {
    amountMinor: 100000,
    currency: 'COP',
    occurredAt: new Date('2026-07-05T00:00:00.000Z'),
  },
  ...overrides,
})

const makePrismaInstance = (overrides = {}) => ({
  id: 'obligation-1',
  tenantId: 'tenant-1',
  sourceType: 'recurring_rule' as const,
  recurringRuleId: 'rule-1',
  period: '2026-07',
  dueDate: new Date('2026-07-05T00:00:00.000Z'),
  name: 'Rent',
  expectedAmountMinor: 230000,
  currency: 'COP',
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-01T00:00:00.000Z'),
  payments: [],
  ...overrides,
})

const duplicateError = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
  code: 'P2002',
  clientVersion: '5.22.0',
})

describe('PrismaObligationRepository', () => {
  it('maps a created instance and its payments onto the domain entity', async () => {
    const prisma = makePrisma()
    prisma.obligationInstance.create.mockResolvedValue(
      makePrismaInstance({ payments: [makePrismaPayment()] }),
    )
    const repository = new PrismaObligationRepository(prisma as any)

    const result = await repository.createInstance({
      tenantId: 'tenant-1',
      sourceType: 'manual',
      recurringRuleId: null,
      period: '2026-07',
      dueDate: new Date('2026-07-05T00:00:00.000Z'),
      name: 'Rent',
      expectedAmountMinor: 230000,
      currency: 'COP',
    })

    // Amount, currency and date come from the transaction, not the link row.
    expect(result.payments[0]).toMatchObject({
      transactionId: 'tx-1',
      amountMinor: 100000,
      currency: 'COP',
      occurredAt: new Date('2026-07-05T00:00:00.000Z'),
    })
  })

  // The unique index on (recurring_rule_id, period) is what makes generation
  // idempotent; losing the race is "already generated", not an error.
  it('returns null when a concurrent generation already created the instance', async () => {
    const prisma = makePrisma()
    prisma.obligationInstance.create.mockRejectedValue(duplicateError)
    const repository = new PrismaObligationRepository(prisma as any)

    const result = await repository.createGeneratedInstance({
      tenantId: 'tenant-1',
      sourceType: 'recurring_rule',
      recurringRuleId: 'rule-1',
      period: '2026-07',
      dueDate: new Date('2026-07-05T00:00:00.000Z'),
      name: 'Rent',
      expectedAmountMinor: 230000,
      currency: 'COP',
    })

    expect(result).toBeNull()
  })

  it('rethrows failures that are not a duplicate', async () => {
    const prisma = makePrisma()
    prisma.obligationInstance.create.mockRejectedValue(new Error('connection lost'))
    const repository = new PrismaObligationRepository(prisma as any)

    await expect(
      repository.createGeneratedInstance({
        tenantId: 'tenant-1',
        sourceType: 'recurring_rule',
        recurringRuleId: 'rule-1',
        period: '2026-07',
        dueDate: new Date('2026-07-05T00:00:00.000Z'),
        name: 'Rent',
        expectedAmountMinor: 230000,
        currency: 'COP',
      }),
    ).rejects.toThrow('connection lost')
  })

  it('scopes an instance lookup to the tenant', async () => {
    const prisma = makePrisma()
    prisma.obligationInstance.findFirst.mockResolvedValue(makePrismaInstance())
    const repository = new PrismaObligationRepository(prisma as any)

    await repository.findInstanceByIdForTenant('obligation-1', 'tenant-1')

    expect(prisma.obligationInstance.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'obligation-1', tenantId: 'tenant-1' },
      }),
    )
  })

  it('returns null for an instance outside the tenant', async () => {
    const prisma = makePrisma()
    prisma.obligationInstance.findFirst.mockResolvedValue(null)
    const repository = new PrismaObligationRepository(prisma as any)

    expect(
      await repository.findInstanceByIdForTenant('obligation-1', 'other-tenant'),
    ).toBeNull()
  })

  it('lists a period ordered by due date', async () => {
    const prisma = makePrisma()
    prisma.obligationInstance.findMany.mockResolvedValue([makePrismaInstance()])
    const repository = new PrismaObligationRepository(prisma as any)

    const result = await repository.listInstancesByPeriod('tenant-1', '2026-07')

    expect(prisma.obligationInstance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1', period: '2026-07' },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
      }),
    )
    expect(result).toHaveLength(1)
  })

  it('reports which rules a period has already materialized', async () => {
    const prisma = makePrisma()
    prisma.obligationInstance.findMany.mockResolvedValue([
      { recurringRuleId: 'rule-1' },
      { recurringRuleId: 'rule-2' },
    ])
    const repository = new PrismaObligationRepository(prisma as any)

    const result = await repository.listGeneratedRuleIdsForPeriod('tenant-1', '2026-07')

    expect(prisma.obligationInstance.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', period: '2026-07', recurringRuleId: { not: null } },
      select: { recurringRuleId: true },
    })
    expect(result).toEqual(['rule-1', 'rule-2'])
  })

  it('finds the payment already claiming a transaction, scoped to the tenant', async () => {
    const prisma = makePrisma()
    prisma.obligationPayment.findFirst.mockResolvedValue(makePrismaPayment())
    const repository = new PrismaObligationRepository(prisma as any)

    const result = await repository.findPaymentByTransactionId('tenant-1', 'tx-1')

    expect(prisma.obligationPayment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1', transactionId: 'tx-1' },
      }),
    )
    expect(result?.obligationInstanceId).toBe('obligation-1')
  })

  it('unlinks a payment with the tenant in the WHERE clause', async () => {
    const prisma = makePrisma()
    prisma.obligationPayment.deleteMany.mockResolvedValue({ count: 1 })
    const repository = new PrismaObligationRepository(prisma as any)

    const result = await repository.deletePayment('tenant-1', 'obligation-1', 'tx-1')

    expect(prisma.obligationPayment.deleteMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        obligationInstanceId: 'obligation-1',
        transactionId: 'tx-1',
      },
    })
    expect(result).toBe(true)
  })

  it('reports no deletion when the payment is not in the tenant', async () => {
    const prisma = makePrisma()
    prisma.obligationPayment.deleteMany.mockResolvedValue({ count: 0 })
    const repository = new PrismaObligationRepository(prisma as any)

    expect(await repository.deletePayment('other-tenant', 'obligation-1', 'tx-1')).toBe(
      false,
    )
  })

  describe('period aggregates', () => {
    // Summing across currencies would be arithmetic on incomparable units.
    it('groups expected totals by currency in SQL', async () => {
      const prisma = makePrisma()
      prisma.obligationInstance.groupBy.mockResolvedValue([
        { currency: 'COP', _sum: { expectedAmountMinor: 230000 } },
        { currency: 'USD', _sum: { expectedAmountMinor: 50000 } },
      ])
      const repository = new PrismaObligationRepository(prisma as any)

      const result = await repository.sumExpectedByCurrency('tenant-1', '2026-07')

      expect(prisma.obligationInstance.groupBy).toHaveBeenCalledWith({
        by: ['currency'],
        where: { tenantId: 'tenant-1', period: '2026-07' },
        _sum: { expectedAmountMinor: true },
      })
      expect(result).toEqual([
        { currency: 'COP', expectedMinor: 230000 },
        { currency: 'USD', expectedMinor: 50000 },
      ])
    })

    it('walks the payment relation to sum settled amounts without loading rows', async () => {
      const prisma = makePrisma()
      prisma.transaction.groupBy.mockResolvedValue([
        { currency: 'COP', _sum: { amountMinor: 100000 } },
      ])
      const repository = new PrismaObligationRepository(prisma as any)

      const result = await repository.sumPaidByCurrency('tenant-1', '2026-07')

      expect(prisma.transaction.groupBy).toHaveBeenCalledWith({
        by: ['currency'],
        where: {
          tenantId: 'tenant-1',
          obligationPayment: {
            is: {
              tenantId: 'tenant-1',
              obligationInstance: { is: { tenantId: 'tenant-1', period: '2026-07' } },
            },
          },
        },
        _sum: { amountMinor: true },
      })
      expect(result).toEqual([{ currency: 'COP', paidMinor: 100000 }])
    })

    it.each([
      ['expected', 'sumExpectedByCurrency'],
      ['paid', 'sumPaidByCurrency'],
    ] as const)('reports a zero %s total rather than null', async (_label, method) => {
      const prisma = makePrisma()
      prisma.obligationInstance.groupBy.mockResolvedValue([
        { currency: 'COP', _sum: { expectedAmountMinor: null } },
      ])
      prisma.transaction.groupBy.mockResolvedValue([
        { currency: 'COP', _sum: { amountMinor: null } },
      ])
      const repository = new PrismaObligationRepository(prisma as any)

      const [total] = await repository[method]('tenant-1', '2026-07')

      expect(Object.values(total)).toContain(0)
    })
  })
})
