import 'reflect-metadata'
import { Reflector } from '@nestjs/core'
import { BadRequestException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'
import { PERMISSION_KEY } from '../../../../../../common/guards/role.guard'
import { ObligationsController } from '../obligations.controller'

const request = {
  tenantId: 'tenant-1',
  user: { id: 'user-1' },
  requestId: 'req-1',
} as any

describe('ObligationsController', () => {
  it('requires read permission to list a period', () => {
    const reflector = new Reflector()

    expect(
      reflector.get(PERMISSION_KEY, ObligationsController.prototype.listPeriod),
    ).toBe('obligation:read')
  })

  it.each(['createObligation', 'reconcile', 'removePayment'] as const)(
    'requires write permission for %s',
    (method) => {
      const reflector = new Reflector()

      expect(reflector.get(PERMISSION_KEY, ObligationsController.prototype[method])).toBe(
        'obligation:write',
      )
    },
  )

  it('lists the requested period for the active tenant', async () => {
    const obligationService = { listPeriod: vi.fn().mockResolvedValue([{ id: 'o-1' }]) }
    const controller = new ObligationsController(obligationService as any)

    const result = await controller.listPeriod(request, '2026-07')

    expect(obligationService.listPeriod).toHaveBeenCalledWith('tenant-1', '2026-07')
    expect(result).toEqual({ data: { obligations: [{ id: 'o-1' }] } })
  })

  // The board opens on "this month" without the client having to compute it.
  it('defaults to the current period when none is given', async () => {
    const obligationService = { listPeriod: vi.fn().mockResolvedValue([]) }
    const controller = new ObligationsController(obligationService as any)

    await controller.listPeriod(request)

    const [, period] = obligationService.listPeriod.mock.calls[0]
    expect(period).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/)
  })

  it.each(['2026-13', 'july', '2026-7'])('rejects the malformed period %s', async (period) => {
    const obligationService = { listPeriod: vi.fn() }
    const controller = new ObligationsController(obligationService as any)

    await expect(controller.listPeriod(request, period)).rejects.toThrow(
      BadRequestException,
    )
    expect(obligationService.listPeriod).not.toHaveBeenCalled()
  })

  it('requires read permission for the period summary', () => {
    const reflector = new Reflector()

    expect(
      reflector.get(PERMISSION_KEY, ObligationsController.prototype.getSummary),
    ).toBe('obligation:read')
  })

  it('returns the period summary for the active tenant', async () => {
    const obligationService = {
      getPeriodSummary: vi
        .fn()
        .mockResolvedValue({ period: '2026-07', totals: [] }),
    }
    const controller = new ObligationsController(obligationService as any)

    const result = await controller.getSummary(request, '2026-07')

    expect(obligationService.getPeriodSummary).toHaveBeenCalledWith(
      'tenant-1',
      '2026-07',
    )
    expect(result).toEqual({ data: { summary: { period: '2026-07', totals: [] } } })
  })

  it('rejects a malformed period on the summary too', async () => {
    const obligationService = { getPeriodSummary: vi.fn() }
    const controller = new ObligationsController(obligationService as any)

    await expect(controller.getSummary(request, '2026-13')).rejects.toThrow(
      BadRequestException,
    )
    expect(obligationService.getPeriodSummary).not.toHaveBeenCalled()
  })

  it('creates a one-off obligation with the request context', async () => {
    const obligationService = {
      createManualObligation: vi.fn().mockResolvedValue({ id: 'o-1' }),
    }
    const controller = new ObligationsController(obligationService as any)

    const result = await controller.createObligation(request, {
      name: 'Income tax filing',
      period: '2026-07',
      dueDate: '2026-07-15T00:00:00.000Z',
      expectedAmountMinor: 120000,
      currency: 'COP',
    })

    expect(obligationService.createManualObligation).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      actorUserId: 'user-1',
      correlationId: 'req-1',
      name: 'Income tax filing',
      period: '2026-07',
      dueDate: '2026-07-15T00:00:00.000Z',
      expectedAmountMinor: 120000,
      currency: 'COP',
    })
    expect(result).toEqual({ data: { obligation: { id: 'o-1' } } })
  })

  it('reconciles an obligation with a transaction', async () => {
    const obligationService = { reconcile: vi.fn().mockResolvedValue({ id: 'o-1' }) }
    const controller = new ObligationsController(obligationService as any)

    const result = await controller.reconcile(request, 'o-1', { transactionId: 'tx-1' })

    expect(obligationService.reconcile).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      actorUserId: 'user-1',
      correlationId: 'req-1',
      obligationId: 'o-1',
      transactionId: 'tx-1',
    })
    expect(result).toEqual({ data: { obligation: { id: 'o-1' } } })
  })

  it('removes a payment from an obligation', async () => {
    const obligationService = { removePayment: vi.fn().mockResolvedValue({ id: 'o-1' }) }
    const controller = new ObligationsController(obligationService as any)

    await controller.removePayment(request, 'o-1', 'tx-1')

    expect(obligationService.removePayment).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      actorUserId: 'user-1',
      correlationId: 'req-1',
      obligationId: 'o-1',
      transactionId: 'tx-1',
    })
  })

  it('falls back to a null actor and unknown correlation id', async () => {
    const obligationService = { reconcile: vi.fn().mockResolvedValue({ id: 'o-1' }) }
    const controller = new ObligationsController(obligationService as any)

    await controller.reconcile({ tenantId: 'tenant-1' } as any, 'o-1', {
      transactionId: 'tx-1',
    })

    expect(obligationService.reconcile).toHaveBeenCalledWith(
      expect.objectContaining({ actorUserId: null, correlationId: 'unknown' }),
    )
  })
})
