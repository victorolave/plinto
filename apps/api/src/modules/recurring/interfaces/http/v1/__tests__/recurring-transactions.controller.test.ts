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

    expect(recurringService.listRules).toHaveBeenCalledWith('tenant-1', {
      includeArchived: false,
    })
    expect(result).toEqual({ data: { rules: [{ id: 'rule-1' }] } })
  })

  it.each([
    ['true', true],
    ['false', false],
    [undefined, false],
  ])('maps includeArchived=%s to %s', async (query, expected) => {
    const recurringService = { listRules: vi.fn().mockResolvedValue([]) }
    const controller = new RecurringTransactionsController(recurringService as any)

    await controller.listRules({ tenantId: 'tenant-1' } as any, query as any)

    expect(recurringService.listRules).toHaveBeenCalledWith('tenant-1', {
      includeArchived: expected,
    })
  })

  it('creates recurring rules using tenant context and validated body', async () => {
    const recurringService = {
      createRule: vi.fn().mockResolvedValue({ id: 'rule-1' }),
    }
    const controller = new RecurringTransactionsController(recurringService as any)

    const result = await controller.createRule(
      { tenantId: 'tenant-1', user: { id: 'user-1' }, requestId: 'req-1' } as any,
      {
        name: 'Monthly rent',
        accountId: 'account-1',
        type: 'expense',
        amountMinor: 250000,
        frequency: 'monthly',
        dayOfMonth: 5,
        startDate: '2026-07-01T00:00:00.000Z',
        status: 'active',
      },
    )

    expect(recurringService.createRule).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      actorUserId: 'user-1',
      correlationId: 'req-1',
      name: 'Monthly rent',
      accountId: 'account-1',
      type: 'expense',
      amountMinor: 250000,
      dayOfMonth: 5,
      startDate: '2026-07-01T00:00:00.000Z',
      status: 'active',
    })
    expect(result).toEqual({ data: { rule: { id: 'rule-1' } } })
  })

  // Retiring a template moves no money and destroys no record, so it is the
  // same class of act as editing one — no dedicated delete permission.
  it.each(['updateRule', 'pauseRule', 'resumeRule', 'restoreRule', 'archiveRule'] as const)(
    'requires write permission for %s',
    (method) => {
      const reflector = new Reflector()
      const permission = reflector.get(
        PERMISSION_KEY,
        RecurringTransactionsController.prototype[method],
      )

      expect(permission).toBe('transaction:write')
    },
  )

  it('updates a rule with tenant context, actor and validated body', async () => {
    const recurringService = {
      updateRule: vi.fn().mockResolvedValue({ id: 'rule-1' }),
    }
    const controller = new RecurringTransactionsController(recurringService as any)

    const result = await controller.updateRule(
      { tenantId: 'tenant-1', user: { id: 'user-1' }, requestId: 'req-1' } as any,
      'rule-1',
      { amountMinor: 300000 },
    )

    expect(recurringService.updateRule).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      actorUserId: 'user-1',
      correlationId: 'req-1',
      id: 'rule-1',
      name: undefined,
      amountMinor: 300000,
      dayOfMonth: undefined,
      startDate: undefined,
    })
    expect(result).toEqual({ data: { rule: { id: 'rule-1' } } })
  })

  it.each([
    ['pauseRule', 'pauseRule'],
    ['resumeRule', 'resumeRule'],
    ['restoreRule', 'restoreRule'],
    ['archiveRule', 'archiveRule'],
  ] as const)('delegates %s to the service with the request context', async (method, call) => {
    const recurringService = { [call]: vi.fn().mockResolvedValue({ id: 'rule-1' }) }
    const controller = new RecurringTransactionsController(recurringService as any)

    const result = await controller[method](
      { tenantId: 'tenant-1', user: { id: 'user-1' }, requestId: 'req-1' } as any,
      'rule-1',
    )

    expect(recurringService[call]).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      actorUserId: 'user-1',
      correlationId: 'req-1',
      id: 'rule-1',
    })
    expect(result).toEqual({ data: { rule: { id: 'rule-1' } } })
  })

  // An unauthenticated-but-tenant-scoped path must still produce a usable
  // audit row rather than crashing on a missing actor.
  it('falls back to a null actor and unknown correlation id', async () => {
    const recurringService = { archiveRule: vi.fn().mockResolvedValue({ id: 'rule-1' }) }
    const controller = new RecurringTransactionsController(recurringService as any)

    await controller.archiveRule({ tenantId: 'tenant-1' } as any, 'rule-1')

    expect(recurringService.archiveRule).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      actorUserId: null,
      correlationId: 'unknown',
      id: 'rule-1',
    })
  })
})
