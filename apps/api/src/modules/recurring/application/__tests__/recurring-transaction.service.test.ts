import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ConflictException, NotFoundException } from '@nestjs/common'
import { RecurringTransactionService } from '../recurring-transaction.service'

const makeAccount = (overrides = {}) => ({
  id: 'account-1',
  tenantId: 'tenant-1',
  name: 'Main account',
  type: 'bank' as const,
  currency: 'COP',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
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

/** Actor + correlation context every audited mutation carries. */
const context = {
  tenantId: 'tenant-1',
  actorUserId: 'user-1',
  correlationId: 'req-1',
}

describe('RecurringTransactionService', () => {
  let repository: {
    createRule: ReturnType<typeof vi.fn>
    listRulesByTenantId: ReturnType<typeof vi.fn>
    findRuleByIdForTenant: ReturnType<typeof vi.fn>
    updateRuleForTenant: ReturnType<typeof vi.fn>
    setRuleStatusForTenant: ReturnType<typeof vi.fn>
  }
  let accountRepository: { findByIdForTenant: ReturnType<typeof vi.fn> }
  let recurringExecutionService: { executeDue: ReturnType<typeof vi.fn> }
  let auditService: { record: ReturnType<typeof vi.fn> }
  let service: RecurringTransactionService

  beforeEach(() => {
    repository = {
      createRule: vi.fn(),
      listRulesByTenantId: vi.fn(),
      findRuleByIdForTenant: vi.fn(),
      updateRuleForTenant: vi.fn(),
      setRuleStatusForTenant: vi.fn(),
    }
    accountRepository = {
      findByIdForTenant: vi.fn(),
    }
    recurringExecutionService = {
      executeDue: vi.fn(),
    }
    auditService = {
      record: vi.fn().mockResolvedValue(undefined),
    }
    service = new RecurringTransactionService(
      repository as any,
      accountRepository as any,
      recurringExecutionService as any,
      auditService as any,
    )
  })

  it('creates a tenant rule with currency derived from the account', async () => {
    accountRepository.findByIdForTenant.mockResolvedValue(makeAccount({ currency: 'USD' }))
    const rule = makeRule({ currency: 'USD' })
    repository.createRule.mockResolvedValue(rule)

    const result = await service.createRule({
      ...context,
      accountId: 'account-1',
      name: 'Monthly salary',
      type: 'income',
      amountMinor: 500000,
      dayOfMonth: 1,
      startDate: '2026-07-01T00:00:00.000Z',
    })

    expect(accountRepository.findByIdForTenant).toHaveBeenCalledWith('account-1', 'tenant-1')
    expect(repository.createRule).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      accountId: 'account-1',
      name: 'Monthly salary',
      type: 'income',
      amountMinor: 500000,
      currency: 'USD',
      dayOfMonth: 1,
      startDate: new Date('2026-07-01T00:00:00.000Z'),
      status: 'active',
    })
    expect(result).toBe(rule)
  })

  it('rejects missing or cross-tenant accounts without creating a rule', async () => {
    accountRepository.findByIdForTenant.mockResolvedValue(null)

    await expect(
      service.createRule({
        ...context,
        accountId: 'other-account',
        name: 'Monthly rent',
        type: 'expense',
        amountMinor: 250000,
        dayOfMonth: 5,
        startDate: '2026-07-01T00:00:00.000Z',
      }),
    ).rejects.toThrow(NotFoundException)

    expect(repository.createRule).not.toHaveBeenCalled()
  })

  it('preserves an explicitly paused state on rule creation', async () => {
    accountRepository.findByIdForTenant.mockResolvedValue(makeAccount())
    repository.createRule.mockResolvedValue(makeRule({ status: 'paused' }))

    await service.createRule({
      ...context,
      accountId: 'account-1',
      name: 'Paused subscription',
      type: 'expense',
      amountMinor: 10000,
      dayOfMonth: 12,
      startDate: '2026-07-01T00:00:00.000Z',
      status: 'paused',
    })

    expect(repository.createRule).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'paused' }),
    )
  })

  it('lists only rules for the active tenant', async () => {
    const rules = [makeRule()]
    repository.listRulesByTenantId.mockResolvedValue(rules)

    const result = await service.listRules('tenant-1')

    expect(repository.listRulesByTenantId).toHaveBeenCalledWith('tenant-1', {})
    expect(result).toBe(rules)
  })

  it('audits rule creation with the actor and correlation id', async () => {
    accountRepository.findByIdForTenant.mockResolvedValue(makeAccount())
    repository.createRule.mockResolvedValue(makeRule())

    await service.createRule({
      ...context,
      accountId: 'account-1',
      name: 'Monthly rent',
      type: 'expense',
      amountMinor: 250000,
      dayOfMonth: 5,
      startDate: '2026-07-01T00:00:00.000Z',
    })

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        actorUserId: 'user-1',
        correlationId: 'req-1',
        action: 'recurring_rule.created',
        resourceType: 'recurring_rule',
        resourceId: 'rule-1',
      }),
    )
  })

  describe('updateRule', () => {
    it('applies the mutable fields and audits before/after', async () => {
      const existing = makeRule({ amountMinor: 250000 })
      const updated = makeRule({ amountMinor: 300000 })
      repository.findRuleByIdForTenant.mockResolvedValue(existing)
      repository.updateRuleForTenant.mockResolvedValue(updated)

      const result = await service.updateRule({
        ...context,
        id: 'rule-1',
        amountMinor: 300000,
      })

      expect(repository.updateRuleForTenant).toHaveBeenCalledWith('rule-1', 'tenant-1', {
        name: undefined,
        amountMinor: 300000,
        dayOfMonth: undefined,
        startDate: undefined,
      })
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'recurring_rule.updated',
          metadata: expect.objectContaining({
            before: expect.objectContaining({ amountMinor: 250000 }),
            after: expect.objectContaining({ amountMinor: 300000 }),
          }),
        }),
      )
      expect(result).toBe(updated)
    })

    it('rejects a rule from another tenant without writing', async () => {
      repository.findRuleByIdForTenant.mockResolvedValue(null)

      await expect(
        service.updateRule({ ...context, id: 'rule-1', name: 'Hijacked' }),
      ).rejects.toThrow(NotFoundException)

      expect(repository.updateRuleForTenant).not.toHaveBeenCalled()
      expect(auditService.record).not.toHaveBeenCalled()
    })

    // Editing a retired rule would resurrect intent the user already put away.
    it('rejects editing an archived rule', async () => {
      repository.findRuleByIdForTenant.mockResolvedValue(makeRule({ status: 'archived' }))

      await expect(
        service.updateRule({ ...context, id: 'rule-1', name: 'Revived' }),
      ).rejects.toThrow(ConflictException)

      expect(repository.updateRuleForTenant).not.toHaveBeenCalled()
    })
  })

  describe('lifecycle transitions', () => {
    it('pauses an active rule and audits the transition', async () => {
      repository.findRuleByIdForTenant.mockResolvedValue(makeRule({ status: 'active' }))
      const paused = makeRule({ status: 'paused' })
      repository.setRuleStatusForTenant.mockResolvedValue(paused)

      const result = await service.pauseRule({ ...context, id: 'rule-1' })

      expect(repository.setRuleStatusForTenant).toHaveBeenCalledWith(
        'rule-1',
        'tenant-1',
        'paused',
      )
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'recurring_rule.paused',
          metadata: expect.objectContaining({
            before: { status: 'active' },
            after: { status: 'paused' },
          }),
        }),
      )
      expect(result).toBe(paused)
    })

    it('resumes a paused rule back into the job', async () => {
      repository.findRuleByIdForTenant.mockResolvedValue(makeRule({ status: 'paused' }))
      repository.setRuleStatusForTenant.mockResolvedValue(makeRule({ status: 'active' }))

      await service.resumeRule({ ...context, id: 'rule-1' })

      expect(repository.setRuleStatusForTenant).toHaveBeenCalledWith(
        'rule-1',
        'tenant-1',
        'active',
      )
    })

    it.each(['pauseRule', 'resumeRule'] as const)(
      'rejects %s on an archived rule instead of reviving it',
      async (method) => {
        repository.findRuleByIdForTenant.mockResolvedValue(makeRule({ status: 'archived' }))

        await expect(service[method]({ ...context, id: 'rule-1' })).rejects.toThrow(
          ConflictException,
        )

        expect(repository.setRuleStatusForTenant).not.toHaveBeenCalled()
      },
    )

    it.each(['active', 'paused'] as const)('archives a %s rule', async (status) => {
      repository.findRuleByIdForTenant.mockResolvedValue(makeRule({ status }))
      repository.setRuleStatusForTenant.mockResolvedValue(makeRule({ status: 'archived' }))

      await service.archiveRule({ ...context, id: 'rule-1' })

      expect(repository.setRuleStatusForTenant).toHaveBeenCalledWith(
        'rule-1',
        'tenant-1',
        'archived',
      )
    })

    // Restoring means "take it out of the archive so I can look at it". Coming
    // back as active could post money on the next job run with nobody deciding
    // that it should.
    it('restores an archived rule to paused, not straight to active', async () => {
      repository.findRuleByIdForTenant.mockResolvedValue(makeRule({ status: 'archived' }))
      repository.setRuleStatusForTenant.mockResolvedValue(makeRule({ status: 'paused' }))

      await service.restoreRule({ ...context, id: 'rule-1' })

      expect(repository.setRuleStatusForTenant).toHaveBeenCalledWith(
        'rule-1',
        'tenant-1',
        'paused',
      )
    })

    // Without this guard, restore would fall through to the paused transition
    // and switch the job off for a rule nobody asked to stop.
    it('leaves an active rule untouched when restore is called on it', async () => {
      const active = makeRule({ status: 'active' })
      repository.findRuleByIdForTenant.mockResolvedValue(active)

      const result = await service.restoreRule({ ...context, id: 'rule-1' })

      expect(repository.setRuleStatusForTenant).not.toHaveBeenCalled()
      expect(auditService.record).not.toHaveBeenCalled()
      expect(result).toBe(active)
    })

    it.each([
      ['pauseRule', 'paused'],
      ['resumeRule', 'active'],
      ['archiveRule', 'archived'],
    ] as const)(
      'treats %s on an already-%s rule as an idempotent no-op',
      async (method, status) => {
        const existing = makeRule({ status })
        repository.findRuleByIdForTenant.mockResolvedValue(existing)

        const result = await service[method]({ ...context, id: 'rule-1' })

        expect(repository.setRuleStatusForTenant).not.toHaveBeenCalled()
        expect(auditService.record).not.toHaveBeenCalled()
        expect(result).toBe(existing)
      },
    )

    it.each(['pauseRule', 'resumeRule', 'archiveRule', 'restoreRule'] as const)(
      'rejects %s for a rule outside the tenant',
      async (method) => {
        repository.findRuleByIdForTenant.mockResolvedValue(null)

        await expect(service[method]({ ...context, id: 'rule-1' })).rejects.toThrow(
          NotFoundException,
        )

        expect(repository.setRuleStatusForTenant).not.toHaveBeenCalled()
      },
    )
  })

  describe('executeDue', () => {
    it('delegates due execution to the dedicated internal execution service', async () => {
      recurringExecutionService.executeDue.mockResolvedValue({ created: 1, skipped: 0 })

      const result = await service.executeDue({
        dueDate: '2026-07-05T12:00:00.000Z',
        jobId: 'job-1',
      })

      expect(recurringExecutionService.executeDue).toHaveBeenCalledWith({
        dueDate: '2026-07-05T12:00:00.000Z',
        jobId: 'job-1',
      })
      expect(result).toEqual({ created: 1, skipped: 0 })
    })
  })
})
