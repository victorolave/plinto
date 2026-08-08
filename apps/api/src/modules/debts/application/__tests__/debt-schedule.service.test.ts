import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common'
import { DebtScheduleService } from '../debt-schedule.service'

const account = (overrides = {}) => ({
  id: 'acc-addi',
  tenantId: 'tenant-1',
  name: 'ADDI',
  type: 'debt' as const,
  currency: 'COP',
  createdAt: new Date(),
  updatedAt: new Date(),
  archivedAt: null,
  ...overrides,
})

const schedule = (overrides = {}) => ({
  id: 'schedule-1',
  tenantId: 'tenant-1',
  accountId: 'acc-addi',
  name: 'Nevera',
  principalMinor: 600000,
  installmentMinor: 100000,
  installmentCount: 6,
  firstDueDate: new Date('2026-07-15T00:00:00.000Z'),
  currency: 'COP',
  status: 'active' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

describe('DebtScheduleService', () => {
  let repo: {
    create: ReturnType<typeof vi.fn>
    listWithProgress: ReturnType<typeof vi.fn>
    rename: ReturnType<typeof vi.fn>
    setStatus: ReturnType<typeof vi.fn>
  }
  let accounts: { findByIdForTenant: ReturnType<typeof vi.fn> }
  let audit: { record: ReturnType<typeof vi.fn> }
  let service: DebtScheduleService

  const create = (overrides = {}) =>
    service.createSchedule({
      tenantId: 'tenant-1',
      actorUserId: 'user-1',
      correlationId: 'req-1',
      accountId: 'acc-addi',
      name: 'Nevera',
      principalMinor: 600000,
      installmentMinor: 100000,
      installmentCount: 6,
      firstDueDate: '2026-07-15T00:00:00.000Z',
      ...overrides,
    })

  beforeEach(() => {
    repo = {
      create: vi.fn().mockResolvedValue(schedule()),
      listWithProgress: vi.fn().mockResolvedValue([]),
      rename: vi.fn().mockResolvedValue(schedule()),
      setStatus: vi.fn().mockResolvedValue(schedule({ status: 'cancelled' })),
    }
    accounts = { findByIdForTenant: vi.fn().mockResolvedValue(account()) }
    audit = { record: vi.fn().mockResolvedValue(undefined) }

    service = new DebtScheduleService(repo as never, accounts as never, audit as never)
  })

  describe('createSchedule', () => {
    /**
     * The plan repays that account, so it cannot be denominated in anything
     * else. Taking the currency from the account rather than the request also
     * means there is no way to disagree with it.
     */
    it('inherits the currency from the account rather than accepting one', async () => {
      accounts.findByIdForTenant.mockResolvedValue(account({ currency: 'USD' }))

      await create()

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ currency: 'USD' }),
      )
    })

    // A plan pays down something owed. Attached to a bank account it would
    // produce installments that reduce nothing.
    it('refuses an account that is not a liability', async () => {
      accounts.findByIdForTenant.mockResolvedValue(account({ type: 'bank' }))

      await expect(create()).rejects.toBeInstanceOf(UnprocessableEntityException)
      expect(repo.create).not.toHaveBeenCalled()
    })

    it('accepts a credit account, which is a liability too', async () => {
      accounts.findByIdForTenant.mockResolvedValue(account({ type: 'credit' }))

      await expect(create()).resolves.toBeDefined()
    })

    it('reports not found for an account of another tenant', async () => {
      accounts.findByIdForTenant.mockResolvedValue(null)

      await expect(create()).rejects.toBeInstanceOf(NotFoundException)
      expect(audit.record).not.toHaveBeenCalled()
    })

    it('starts owing the whole principal', async () => {
      const view = await create()

      expect(view.paidMinor).toBe(0)
      expect(view.outstandingMinor).toBe(600000)
      expect(view.settled).toBe(false)
    })

    it('records the plan that was taken on', async () => {
      await create()

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'debt_schedule.created',
          metadata: expect.objectContaining({
            principalMinor: 600000,
            installmentCount: 6,
            currency: 'COP',
          }),
        }),
      )
    })
  })

  describe('listSchedules', () => {
    const withProgress = (paidMinor: number, generatedCount: number, overrides = {}) => [
      { schedule: schedule(overrides), paidMinor, generatedCount },
    ]

    it('derives what is still owed from what was actually paid', async () => {
      repo.listWithProgress.mockResolvedValue(withProgress(250000, 3))

      const [view] = await service.listSchedules('tenant-1')

      expect(view.outstandingMinor).toBe(350000)
    })

    /**
     * Overpaying an installment settles the plan; it does not make the lender
     * owe the household.
     */
    it('never reports a negative outstanding', async () => {
      repo.listWithProgress.mockResolvedValue(withProgress(700000, 6))

      const [view] = await service.listSchedules('tenant-1')

      expect(view.outstandingMinor).toBe(0)
    })

    it('settles only once every installment exists and is covered', async () => {
      repo.listWithProgress.mockResolvedValue(withProgress(600000, 6))

      const [view] = await service.listSchedules('tenant-1')

      expect(view.settled).toBe(true)
    })

    /**
     * Paying the principal early does not settle a plan whose remaining
     * installments have not been materialized — those periods still expect a
     * payment, and reporting the plan closed would hide them.
     */
    it('does not settle a plan whose installments are not all generated', async () => {
      repo.listWithProgress.mockResolvedValue(withProgress(600000, 4))

      const [view] = await service.listSchedules('tenant-1')

      expect(view.settled).toBe(false)
      expect(view.outstandingMinor).toBe(0)
    })

    it('does not settle a fully generated plan that is not fully paid', async () => {
      repo.listWithProgress.mockResolvedValue(withProgress(599999, 6))

      const [view] = await service.listSchedules('tenant-1')

      expect(view.settled).toBe(false)
    })
  })

  describe('cancel', () => {
    it('cancels rather than deletes, and records who did it', async () => {
      await service.cancel({
        tenantId: 'tenant-1',
        actorUserId: 'user-1',
        correlationId: 'req-1',
        id: 'schedule-1',
      })

      expect(repo.setStatus).toHaveBeenCalledWith('schedule-1', 'tenant-1', 'cancelled')
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'debt_schedule.cancelled' }),
      )
    })

    it('reports not found for a plan of another household', async () => {
      repo.setStatus.mockResolvedValue(null)

      await expect(
        service.cancel({
          tenantId: 'tenant-1',
          actorUserId: 'user-1',
          correlationId: 'req-1',
          id: 'schedule-other',
        }),
      ).rejects.toBeInstanceOf(NotFoundException)
      expect(audit.record).not.toHaveBeenCalled()
    })
  })

  describe('rename', () => {
    it('reports not found for a plan of another household', async () => {
      repo.rename.mockResolvedValue(null)

      await expect(
        service.rename({
          tenantId: 'tenant-1',
          actorUserId: 'user-1',
          correlationId: 'req-1',
          id: 'schedule-other',
          name: 'Otra',
        }),
      ).rejects.toBeInstanceOf(NotFoundException)
    })
  })
})
