import 'reflect-metadata'
import { Reflector } from '@nestjs/core'
import { describe, expect, it, vi } from 'vitest'
import { PERMISSION_KEY } from '../../../../../../common/guards/role.guard'
import { RecurringTransactionsController } from '../recurring-transactions.controller'

describe('RecurringTransactionsController', () => {
  it('requires read permission to list recurring rules', () => {
    const reflector = new Reflector()
    const permission = reflector.get(
      PERMISSION_KEY,
      RecurringTransactionsController.prototype.listRules,
    )

    expect(permission).toBe('transaction:read')
  })

  it('requires write permission to create recurring rules', () => {
    const reflector = new Reflector()
    const permission = reflector.get(
      PERMISSION_KEY,
      RecurringTransactionsController.prototype.createRule,
    )

    expect(permission).toBe('transaction:write')
  })

  it('lists recurring rules using the active tenant context', async () => {
    const recurringService = {
      listRules: vi.fn().mockResolvedValue([{ id: 'rule-1' }]),
    }
    const controller = new RecurringTransactionsController(recurringService as any)

    const result = await controller.listRules({ tenantId: 'tenant-1' } as any)

    expect(recurringService.listRules).toHaveBeenCalledWith('tenant-1')
    expect(result).toEqual({ data: { rules: [{ id: 'rule-1' }] } })
  })

  it('creates recurring rules using tenant context and validated body', async () => {
    const recurringService = {
      createRule: vi.fn().mockResolvedValue({ id: 'rule-1' }),
    }
    const controller = new RecurringTransactionsController(recurringService as any)

    const result = await controller.createRule(
      { tenantId: 'tenant-1' } as any,
      {
        name: 'Monthly rent',
        accountId: 'account-1',
        type: 'expense',
        amountMinor: 250000,
        frequency: 'monthly',
        dayOfMonth: 5,
        startDate: '2026-07-01T00:00:00.000Z',
        active: true,
      },
    )

    expect(recurringService.createRule).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      name: 'Monthly rent',
      accountId: 'account-1',
      type: 'expense',
      amountMinor: 250000,
      dayOfMonth: 5,
      startDate: '2026-07-01T00:00:00.000Z',
      active: true,
    })
    expect(result).toEqual({ data: { rule: { id: 'rule-1' } } })
  })
})
