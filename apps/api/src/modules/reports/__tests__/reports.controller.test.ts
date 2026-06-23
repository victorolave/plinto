import 'reflect-metadata'
import { describe, it, expect, vi } from 'vitest'
import { BadRequestException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { PERMISSION_KEY } from '../../../common/guards/role.guard'
import { ReportsController } from '../interfaces/http/v1/reports.controller'

describe('ReportsController — permission metadata', () => {
  it('requires report:read to call expenses-by-category', () => {
    const reflector = new Reflector()
    const permission = reflector.get(
      PERMISSION_KEY,
      ReportsController.prototype.getExpensesByCategory,
    )
    expect(permission).toBe('report:read')
  })
})

describe('ReportsController — route behavior', () => {
  const makeService = () => ({
    getExpensesByCategory: vi.fn(),
  })

  it('returns { data: report } on valid from/to', async () => {
    const svc = makeService()
    const items = [
      { categoryId: 'cat-1', categoryName: 'Food', currency: 'USD', totalMinor: 5000 },
    ]
    svc.getExpensesByCategory.mockResolvedValue(items)
    const controller = new ReportsController(svc as any)

    const result = await controller.getExpensesByCategory(
      { tenantId: 'tenant-1' } as any,
      '2026-01-01',
      '2026-01-31',
    )

    // fromDate = start of 2026-01-01 UTC; toDate = end of 2026-01-31 UTC (23:59:59.999Z)
    expect(svc.getExpensesByCategory).toHaveBeenCalledWith(
      'tenant-1',
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-01-31T23:59:59.999Z'),
    )
    expect(result).toEqual({
      data: {
        from: '2026-01-01',
        to: '2026-01-31',
        items,
      },
    })
  })

  it('throws BadRequestException REPORT_INVALID_PERIOD when from is missing', async () => {
    const svc = makeService()
    const controller = new ReportsController(svc as any)

    await expect(
      controller.getExpensesByCategory({ tenantId: 'tenant-1' } as any, undefined as any, '2026-01-31'),
    ).rejects.toThrow(BadRequestException)

    await expect(
      controller.getExpensesByCategory({ tenantId: 'tenant-1' } as any, undefined as any, '2026-01-31'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'REPORT_INVALID_PERIOD' }),
    })
  })

  it('throws BadRequestException REPORT_INVALID_PERIOD when to is missing', async () => {
    const svc = makeService()
    const controller = new ReportsController(svc as any)

    await expect(
      controller.getExpensesByCategory({ tenantId: 'tenant-1' } as any, '2026-01-01', undefined as any),
    ).rejects.toThrow(BadRequestException)
  })

  it('throws BadRequestException REPORT_INVALID_PERIOD when from is an invalid date string', async () => {
    const svc = makeService()
    const controller = new ReportsController(svc as any)

    await expect(
      controller.getExpensesByCategory({ tenantId: 'tenant-1' } as any, 'not-a-date', '2026-01-31'),
    ).rejects.toThrow(BadRequestException)
  })

  it('throws BadRequestException REPORT_INVALID_PERIOD when to is an invalid date string', async () => {
    const svc = makeService()
    const controller = new ReportsController(svc as any)

    await expect(
      controller.getExpensesByCategory({ tenantId: 'tenant-1' } as any, '2026-01-01', 'bad'),
    ).rejects.toThrow(BadRequestException)
  })

  // SHOULD-FIX 3: to=YYYY-MM-DD must cover the entire final day (transactions at 15:00 must be included)
  it('passes toDate as end-of-UTC-day so transactions at 15:00 on the to-date are included (SHOULD-FIX 3)', async () => {
    const svc = makeService()
    svc.getExpensesByCategory.mockResolvedValue([])
    const controller = new ReportsController(svc as any)

    await controller.getExpensesByCategory(
      { tenantId: 'tenant-1' } as any,
      '2026-06-22',
      '2026-06-22',
    )

    const [, , toDateArg] = svc.getExpensesByCategory.mock.calls[0]
    // The to boundary must be at or after 23:59:59.999 UTC of 2026-06-22
    const endOfDay = new Date('2026-06-22T23:59:59.999Z')
    expect((toDateArg as Date).getTime()).toBeGreaterThanOrEqual(endOfDay.getTime())
    // And it must NOT spill into the next day (must be <= 2026-06-23T00:00:00.000Z)
    const startOfNextDay = new Date('2026-06-23T00:00:00.000Z')
    expect((toDateArg as Date).getTime()).toBeLessThan(startOfNextDay.getTime())
  })

  // SHOULD-FIX 5: from > to must be rejected with REPORT_INVALID_PERIOD
  it('throws BadRequestException REPORT_INVALID_PERIOD when from is after to (SHOULD-FIX 5)', async () => {
    const svc = makeService()
    const controller = new ReportsController(svc as any)

    await expect(
      controller.getExpensesByCategory(
        { tenantId: 'tenant-1' } as any,
        '2026-01-31',
        '2026-01-01', // reversed: from > to
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'REPORT_INVALID_PERIOD' }),
    })
  })
})
