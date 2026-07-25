import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConflictException, NotFoundException } from '@nestjs/common'
import { ObligationService } from '../obligation.service'

const NOW = new Date('2026-07-20T00:00:00.000Z')

const context = {
  tenantId: 'tenant-1',
  actorUserId: 'user-1',
  correlationId: 'req-1',
}

const makeInstance = (overrides = {}) => ({
  id: 'obligation-1',
  tenantId: 'tenant-1',
  sourceType: 'recurring_rule' as const,
  recurringRuleId: 'rule-1',
  period: '2026-07',
  dueDate: new Date('2026-07-25T00:00:00.000Z'),
  name: 'Rent',
  expectedAmountMinor: 230000,
  currency: 'COP',
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-01T00:00:00.000Z'),
  payments: [],
  ...overrides,
})

const makeTransaction = (overrides = {}) => ({
  id: 'tx-1',
  tenantId: 'tenant-1',
  accountId: 'account-1',
  type: 'expense' as const,
  amountMinor: 230000,
  currency: 'COP',
  description: 'Rent',
  occurredAt: new Date('2026-07-05T00:00:00.000Z'),
  createdAt: new Date(),
  updatedAt: new Date(),
  transferId: null,
  ...overrides,
})

const makePayment = (overrides = {}) => ({
  id: 'payment-1',
  tenantId: 'tenant-1',
  obligationInstanceId: 'obligation-1',
  transactionId: 'tx-1',
  amountMinor: 230000,
  currency: 'COP',
  occurredAt: new Date('2026-07-05T00:00:00.000Z'),
  createdAt: new Date(),
  ...overrides,
})

describe('ObligationService', () => {
  let obligationRepository: {
    createInstance: ReturnType<typeof vi.fn>
    findInstanceByIdForTenant: ReturnType<typeof vi.fn>
    listInstancesByPeriod: ReturnType<typeof vi.fn>
    createPayment: ReturnType<typeof vi.fn>
    findPaymentByTransactionId: ReturnType<typeof vi.fn>
    deletePayment: ReturnType<typeof vi.fn>
    summarizeByCurrency: ReturnType<typeof vi.fn>
  }
  let transactionRepository: { findByIdForTenant: ReturnType<typeof vi.fn> }
  let auditService: { record: ReturnType<typeof vi.fn> }
  let service: ObligationService

  beforeEach(() => {
    obligationRepository = {
      createInstance: vi.fn(),
      findInstanceByIdForTenant: vi.fn(),
      listInstancesByPeriod: vi.fn().mockResolvedValue([]),
      createPayment: vi.fn().mockResolvedValue(makePayment()),
      findPaymentByTransactionId: vi.fn().mockResolvedValue(null),
      deletePayment: vi.fn().mockResolvedValue(true),
      summarizeByCurrency: vi.fn().mockResolvedValue([]),
    }
    transactionRepository = {
      findByIdForTenant: vi.fn().mockResolvedValue(makeTransaction()),
    }
    auditService = { record: vi.fn().mockResolvedValue(undefined) }
    service = new ObligationService(
      obligationRepository as any,
      transactionRepository as any,
      auditService as any,
    )
  })

  describe('listPeriod', () => {
    it('resolves each instance to its derived state', async () => {
      obligationRepository.listInstancesByPeriod.mockResolvedValue([
        makeInstance({ payments: [makePayment({ amountMinor: 100000 })] }),
      ])

      const [obligation] = await service.listPeriod('tenant-1', '2026-07', NOW)

      expect(obligation.status).toBe('partial')
      expect(obligation.paidAmountMinor).toBe(100000)
      expect(obligation.outstandingAmountMinor).toBe(130000)
    })
  })

  describe('getPeriodSummary', () => {
    it('returns the period totals per currency, straight from the aggregate', async () => {
      obligationRepository.summarizeByCurrency.mockResolvedValue([
        {
          currency: 'COP',
          expectedMinor: 330000,
          paidMinor: 250000,
          outstandingMinor: 100000,
        },
      ])

      const result = await service.getPeriodSummary('tenant-1', '2026-07')

      expect(obligationRepository.summarizeByCurrency).toHaveBeenCalledWith(
        'tenant-1',
        '2026-07',
      )
      expect(result).toEqual({
        period: '2026-07',
        totals: [
          {
            currency: 'COP',
            expectedMinor: 330000,
            paidMinor: 250000,
            outstandingMinor: 100000,
          },
        ],
      })
    })

    it('reports an empty period with no totals', async () => {
      obligationRepository.summarizeByCurrency.mockResolvedValue([])

      expect(await service.getPeriodSummary('tenant-1', '2026-07')).toEqual({
        period: '2026-07',
        totals: [],
      })
    })
  })

  describe('createManualObligation', () => {
    it('always records the instance as manual with no rule behind it', async () => {
      obligationRepository.createInstance.mockResolvedValue(
        makeInstance({ sourceType: 'manual', recurringRuleId: null }),
      )

      await service.createManualObligation({
        ...context,
        name: 'Income tax filing',
        period: '2026-07',
        dueDate: '2026-07-15T00:00:00.000Z',
        expectedAmountMinor: 120000,
        currency: 'COP',
        now: NOW,
      })

      expect(obligationRepository.createInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          sourceType: 'manual',
          recurringRuleId: null,
          dueDate: new Date('2026-07-15T00:00:00.000Z'),
        }),
      )
    })

    it('audits creation with the actor and correlation id', async () => {
      obligationRepository.createInstance.mockResolvedValue(makeInstance())

      await service.createManualObligation({
        ...context,
        name: 'Income tax filing',
        period: '2026-07',
        dueDate: '2026-07-15T00:00:00.000Z',
        expectedAmountMinor: 120000,
        currency: 'COP',
        now: NOW,
      })

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          actorUserId: 'user-1',
          correlationId: 'req-1',
          action: 'obligation.created',
          resourceType: 'obligation',
          resourceId: 'obligation-1',
        }),
      )
    })
  })

  describe('reconcile', () => {
    it('links the transaction and returns the obligation as paid', async () => {
      obligationRepository.findInstanceByIdForTenant
        .mockResolvedValueOnce(makeInstance())
        .mockResolvedValueOnce(makeInstance({ payments: [makePayment()] }))

      const result = await service.reconcile({
        ...context,
        obligationId: 'obligation-1',
        transactionId: 'tx-1',
        now: NOW,
      })

      expect(obligationRepository.createPayment).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        obligationInstanceId: 'obligation-1',
        transactionId: 'tx-1',
      })
      expect(result.status).toBe('paid')
      expect(result.outstandingAmountMinor).toBe(0)
    })

    it('reports partial when the transaction covers only part of the amount', async () => {
      obligationRepository.findInstanceByIdForTenant
        .mockResolvedValueOnce(makeInstance())
        .mockResolvedValueOnce(
          makeInstance({ payments: [makePayment({ amountMinor: 100000 })] }),
        )
      obligationRepository.createPayment.mockResolvedValue(
        makePayment({ amountMinor: 100000 }),
      )
      transactionRepository.findByIdForTenant.mockResolvedValue(
        makeTransaction({ amountMinor: 100000 }),
      )

      const result = await service.reconcile({
        ...context,
        obligationId: 'obligation-1',
        transactionId: 'tx-1',
        now: NOW,
      })

      expect(result.status).toBe('partial')
      expect(result.outstandingAmountMinor).toBe(130000)
    })

    it('rejects an obligation from another tenant without touching the transaction', async () => {
      obligationRepository.findInstanceByIdForTenant.mockResolvedValue(null)

      await expect(
        service.reconcile({
          ...context,
          obligationId: 'obligation-1',
          transactionId: 'tx-1',
        }),
      ).rejects.toThrow(NotFoundException)

      expect(transactionRepository.findByIdForTenant).not.toHaveBeenCalled()
      expect(obligationRepository.createPayment).not.toHaveBeenCalled()
    })

    it('rejects a transaction from another tenant', async () => {
      obligationRepository.findInstanceByIdForTenant.mockResolvedValue(makeInstance())
      transactionRepository.findByIdForTenant.mockResolvedValue(null)

      await expect(
        service.reconcile({
          ...context,
          obligationId: 'obligation-1',
          transactionId: 'tx-1',
        }),
      ).rejects.toThrow(NotFoundException)

      expect(obligationRepository.createPayment).not.toHaveBeenCalled()
    })

    // Linking a credit would report the household as having paid a bill it was
    // actually paid for.
    it('rejects settling an obligation with income', async () => {
      obligationRepository.findInstanceByIdForTenant.mockResolvedValue(makeInstance())
      transactionRepository.findByIdForTenant.mockResolvedValue(
        makeTransaction({ type: 'income' }),
      )

      await expect(
        service.reconcile({
          ...context,
          obligationId: 'obligation-1',
          transactionId: 'tx-1',
        }),
      ).rejects.toThrow(ConflictException)

      expect(obligationRepository.createPayment).not.toHaveBeenCalled()
    })

    // Conversion belongs to PRD-008; until then the period totals must not add
    // incomparable units.
    it('rejects a transaction in a different currency', async () => {
      obligationRepository.findInstanceByIdForTenant.mockResolvedValue(makeInstance())
      transactionRepository.findByIdForTenant.mockResolvedValue(
        makeTransaction({ currency: 'USD' }),
      )

      await expect(
        service.reconcile({
          ...context,
          obligationId: 'obligation-1',
          transactionId: 'tx-1',
        }),
      ).rejects.toThrow(ConflictException)

      expect(obligationRepository.createPayment).not.toHaveBeenCalled()
    })

    it('rejects a transaction that already settles another obligation', async () => {
      obligationRepository.findInstanceByIdForTenant.mockResolvedValue(makeInstance())
      obligationRepository.findPaymentByTransactionId.mockResolvedValue(
        makePayment({ obligationInstanceId: 'obligation-2' }),
      )

      await expect(
        service.reconcile({
          ...context,
          obligationId: 'obligation-1',
          transactionId: 'tx-1',
        }),
      ).rejects.toThrow(ConflictException)

      expect(obligationRepository.createPayment).not.toHaveBeenCalled()
    })

    // The unique index catches what the check above cannot: a concurrent
    // caller claiming the transaction in between.
    it('turns a duplicate-signal (null) insert into a conflict, not a 500', async () => {
      obligationRepository.findInstanceByIdForTenant.mockResolvedValue(makeInstance())
      obligationRepository.createPayment.mockResolvedValue(null)

      await expect(
        service.reconcile({
          ...context,
          obligationId: 'obligation-1',
          transactionId: 'tx-1',
        }),
      ).rejects.toThrow(ConflictException)

      expect(auditService.record).not.toHaveBeenCalled()
    })

    it('audits the reconciliation with both amounts', async () => {
      obligationRepository.findInstanceByIdForTenant
        .mockResolvedValueOnce(makeInstance())
        .mockResolvedValueOnce(makeInstance({ payments: [makePayment()] }))

      await service.reconcile({
        ...context,
        obligationId: 'obligation-1',
        transactionId: 'tx-1',
        now: NOW,
      })

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'obligation.reconciled',
          resourceType: 'obligation',
          metadata: expect.objectContaining({
            transactionId: 'tx-1',
            amountMinor: 230000,
            expectedAmountMinor: 230000,
          }),
        }),
      )
    })
  })

  describe('removePayment', () => {
    it('unlinks the transaction and returns the obligation as pending again', async () => {
      obligationRepository.findInstanceByIdForTenant
        .mockResolvedValueOnce(makeInstance({ payments: [makePayment()] }))
        .mockResolvedValueOnce(makeInstance({ payments: [] }))

      const result = await service.removePayment({
        ...context,
        obligationId: 'obligation-1',
        transactionId: 'tx-1',
        now: NOW,
      })

      expect(obligationRepository.deletePayment).toHaveBeenCalledWith(
        'tenant-1',
        'obligation-1',
        'tx-1',
      )
      expect(result.status).toBe('pending')
      expect(result.paidAmountMinor).toBe(0)
    })

    it('rejects unlinking from an obligation outside the tenant', async () => {
      obligationRepository.findInstanceByIdForTenant.mockResolvedValue(null)

      await expect(
        service.removePayment({
          ...context,
          obligationId: 'obligation-1',
          transactionId: 'tx-1',
        }),
      ).rejects.toThrow(NotFoundException)

      expect(obligationRepository.deletePayment).not.toHaveBeenCalled()
    })

    it('rejects unlinking a transaction that does not settle this obligation', async () => {
      obligationRepository.findInstanceByIdForTenant.mockResolvedValue(makeInstance())
      obligationRepository.deletePayment.mockResolvedValue(false)

      await expect(
        service.removePayment({
          ...context,
          obligationId: 'obligation-1',
          transactionId: 'tx-9',
        }),
      ).rejects.toThrow(NotFoundException)

      expect(auditService.record).not.toHaveBeenCalled()
    })

    it('audits the removal', async () => {
      obligationRepository.findInstanceByIdForTenant
        .mockResolvedValueOnce(makeInstance({ payments: [makePayment()] }))
        .mockResolvedValueOnce(makeInstance({ payments: [] }))

      await service.removePayment({
        ...context,
        obligationId: 'obligation-1',
        transactionId: 'tx-1',
        now: NOW,
      })

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'obligation.payment_removed',
          metadata: expect.objectContaining({ transactionId: 'tx-1' }),
        }),
      )
    })
  })
})
