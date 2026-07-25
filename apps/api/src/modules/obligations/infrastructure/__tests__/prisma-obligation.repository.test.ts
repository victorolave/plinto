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
  $queryRaw: vi.fn(),
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

  it('maps a created payment using the amounts of its transaction', async () => {
    const prisma = makePrisma()
    prisma.obligationPayment.create.mockResolvedValue(makePrismaPayment())
    const repository = new PrismaObligationRepository(prisma as any)

    const result = await repository.createPayment({
      tenantId: 'tenant-1',
      obligationInstanceId: 'obligation-1',
      transactionId: 'tx-1',
    })

    expect(result).toMatchObject({ transactionId: 'tx-1', amountMinor: 100000 })
  })

  // The global unique index on transaction_id firing means a concurrent caller
  // reconciled it first — a conflict for the service, never a 500.
  it('returns null when the transaction is already claimed by another payment', async () => {
    const prisma = makePrisma()
    prisma.obligationPayment.create.mockRejectedValue(duplicateError)
    const repository = new PrismaObligationRepository(prisma as any)

    const result = await repository.createPayment({
      tenantId: 'tenant-1',
      obligationInstanceId: 'obligation-1',
      transactionId: 'tx-1',
    })

    expect(result).toBeNull()
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

  describe('summarizeByCurrency', () => {
    it('returns one set of totals per currency', async () => {
      const prisma = makePrisma()
      prisma.$queryRaw.mockResolvedValue([
        {
          currency: 'COP',
          expected_minor: 330000n,
          paid_minor: 250000n,
          outstanding_minor: 100000n,
        },
        {
          currency: 'USD',
          expected_minor: 50000n,
          paid_minor: 0n,
          outstanding_minor: 50000n,
        },
      ])
      const repository = new PrismaObligationRepository(prisma as any)

      const result = await repository.summarizeByCurrency('tenant-1', '2026-07')

      expect(result).toEqual([
        {
          currency: 'COP',
          expectedMinor: 330000,
          paidMinor: 250000,
          outstandingMinor: 100000,
        },
        { currency: 'USD', expectedMinor: 50000, paidMinor: 0, outstandingMinor: 50000 },
      ])
    })

    // Postgres widens SUM(int) to bigint; the driver may hand it back as a
    // BigInt or a numeric string depending on the type.
    it.each([
      ['bigint', 330000n, 250000n, 100000n],
      ['string', '330000', '250000', '100000'],
      ['number', 330000, 250000, 100000],
    ])('narrows %s sums to plain numbers', async (_label, expected, paid, outstanding) => {
      const prisma = makePrisma()
      prisma.$queryRaw.mockResolvedValue([
        {
          currency: 'COP',
          expected_minor: expected,
          paid_minor: paid,
          outstanding_minor: outstanding,
        },
      ])
      const repository = new PrismaObligationRepository(prisma as any)

      const [total] = await repository.summarizeByCurrency('tenant-1', '2026-07')

      expect(total).toEqual({
        currency: 'COP',
        expectedMinor: 330000,
        paidMinor: 250000,
        outstandingMinor: 100000,
      })
    })

    it('reports zero rather than null for an empty sum', async () => {
      const prisma = makePrisma()
      prisma.$queryRaw.mockResolvedValue([
        {
          currency: 'COP',
          expected_minor: null,
          paid_minor: null,
          outstanding_minor: null,
        },
      ])
      const repository = new PrismaObligationRepository(prisma as any)

      const [total] = await repository.summarizeByCurrency('tenant-1', '2026-07')

      expect(total).toEqual({
        currency: 'COP',
        expectedMinor: 0,
        paidMinor: 0,
        outstandingMinor: 0,
      })
    })

    it('returns nothing for a period with no obligations', async () => {
      const prisma = makePrisma()
      prisma.$queryRaw.mockResolvedValue([])
      const repository = new PrismaObligationRepository(prisma as any)

      expect(await repository.summarizeByCurrency('tenant-1', '2026-07')).toEqual([])
    })

    // The tenant and period are parameterized, never interpolated into the SQL.
    it('passes the tenant and period as query parameters', async () => {
      const prisma = makePrisma()
      prisma.$queryRaw.mockResolvedValue([])
      const repository = new PrismaObligationRepository(prisma as any)

      await repository.summarizeByCurrency('tenant-1', '2026-07')

      const [strings, ...values] = prisma.$queryRaw.mock.calls[0]
      expect(Array.isArray(strings)).toBe(true)
      expect(values).toEqual(['tenant-1', '2026-07'])
    })

    // The whole reason this aggregate is raw SQL: outstanding must be the sum
    // of each obligation's own shortfall, so an overpayment on one cannot
    // absorb the shortfall of another.
    it('sums per-obligation shortfalls rather than subtracting the totals', async () => {
      const prisma = makePrisma()
      prisma.$queryRaw.mockResolvedValue([])
      const repository = new PrismaObligationRepository(prisma as any)

      await repository.summarizeByCurrency('tenant-1', '2026-07')

      const sql = prisma.$queryRaw.mock.calls[0][0].join('?').replace(/\s+/g, ' ')
      expect(sql).toContain('SUM(GREATEST(')
      expect(sql).toContain('GROUP BY op."obligation_instance_id"')
    })
  })
})
