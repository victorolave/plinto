import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NotFoundException } from '@nestjs/common'
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

describe('RecurringTransactionService', () => {
  let repository: {
    createRule: ReturnType<typeof vi.fn>
    listRulesByTenantId: ReturnType<typeof vi.fn>
  }
  let accountRepository: { findByIdForTenant: ReturnType<typeof vi.fn> }
  let recurringExecutionService: { executeDue: ReturnType<typeof vi.fn> }
  let service: RecurringTransactionService

  beforeEach(() => {
    repository = {
      createRule: vi.fn(),
      listRulesByTenantId: vi.fn(),
    }
    accountRepository = {
      findByIdForTenant: vi.fn(),
    }
    recurringExecutionService = {
      executeDue: vi.fn(),
    }
    service = new RecurringTransactionService(
      repository as any,
      accountRepository as any,
      recurringExecutionService as any,
    )
  })

  it('creates a tenant rule with currency derived from the account', async () => {
    accountRepository.findByIdForTenant.mockResolvedValue(makeAccount({ currency: 'USD' }))
    const rule = makeRule({ currency: 'USD' })
    repository.createRule.mockResolvedValue(rule)

    const result = await service.createRule({
      tenantId: 'tenant-1',
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
        tenantId: 'tenant-1',
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
      tenantId: 'tenant-1',
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

    expect(repository.listRulesByTenantId).toHaveBeenCalledWith('tenant-1')
    expect(result).toBe(rules)
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
