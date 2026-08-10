import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common'
import { CreditLineStatementService } from '../credit-line-statement.service'

const line = (overrides = {}) => ({
  id: 'line-addi',
  tenantId: 'tenant-1',
  name: 'ADDI',
  limitMinor: 1200000,
  currency: 'COP',
  status: 'active' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

const statement = (overrides = {}) => ({
  id: 'stmt-1',
  tenantId: 'tenant-1',
  creditLineId: 'line-addi',
  period: '2026-07',
  cutoffDate: new Date('2026-07-12T00:00:00.000Z'),
  dueDate: new Date('2026-07-20T00:00:00.000Z'),
  closingBalanceMinor: 800000,
  amountDueMinor: 300000,
  limitMinorSnapshot: 1200000,
  currency: 'COP',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

describe('CreditLineStatementService', () => {
  let statements: {
    create: ReturnType<typeof vi.fn>
    findByIdForTenant: ReturnType<typeof vi.fn>
    listForLine: ReturnType<typeof vi.fn>
    listLatestPerLine: ReturnType<typeof vi.fn>
    findWithPayment: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
  let lines: {
    findByIdForTenant: ReturnType<typeof vi.fn>
    listForTenant: ReturnType<typeof vi.fn>
  }
  let audit: { record: ReturnType<typeof vi.fn> }
  let service: CreditLineStatementService

  const record = (overrides = {}) =>
    service.recordStatement({
      tenantId: 'tenant-1',
      actorUserId: 'user-1',
      correlationId: 'req-1',
      creditLineId: 'line-addi',
      cutoffDate: '2026-07-12T00:00:00.000Z',
      dueDate: '2026-07-20T00:00:00.000Z',
      closingBalanceMinor: 800000,
      amountDueMinor: 300000,
      ...overrides,
    })

  beforeEach(() => {
    statements = {
      create: vi.fn().mockResolvedValue(statement()),
      findByIdForTenant: vi.fn().mockResolvedValue(statement()),
      listForLine: vi.fn().mockResolvedValue([statement()]),
      listLatestPerLine: vi.fn().mockResolvedValue([]),
      findWithPayment: vi.fn().mockResolvedValue({ statement: statement(), paidMinor: 0 }),
      update: vi.fn().mockResolvedValue(statement()),
    }
    lines = {
      findByIdForTenant: vi.fn().mockResolvedValue(line()),
      listForTenant: vi.fn().mockResolvedValue([line()]),
    }
    audit = { record: vi.fn().mockResolvedValue(undefined) }

    service = new CreditLineStatementService(
      statements as never,
      lines as never,
      audit as never,
    )
  })

  describe('recordStatement', () => {
    it('derives the period from the cutoff rather than taking it', async () => {
      await record()

      expect(statements.create).toHaveBeenCalledWith(
        expect.objectContaining({ period: '2026-07' }),
      )
    })

    // Frozen at record time: raising the ceiling tomorrow must not restate
    // what this statement said was available.
    it('freezes the line’s current limit onto the statement', async () => {
      await record()

      expect(statements.create).toHaveBeenCalledWith(
        expect.objectContaining({ limitMinorSnapshot: 1200000 }),
      )
    })

    it('inherits the currency from the line instead of accepting one', async () => {
      lines.findByIdForTenant.mockResolvedValue(line({ currency: 'USD' }))

      await record()

      expect(statements.create).toHaveBeenCalledWith(
        expect.objectContaining({ currency: 'USD' }),
      )
    })

    it('reports the available credit the statement implies', async () => {
      const view = await record()

      expect(view.availableMinor).toBe(400000)
    })

    it('raises a typed 404 when the line is not the tenant’s', async () => {
      lines.findByIdForTenant.mockResolvedValue(null)

      await expect(record()).rejects.toThrow(NotFoundException)
      expect(statements.create).not.toHaveBeenCalled()
    })

    // A closed line issues nothing, so an obligation from one would demand
    // payment for a bill that cannot arrive.
    it('refuses to record against a closed line', async () => {
      lines.findByIdForTenant.mockResolvedValue(line({ status: 'closed' }))

      await expect(record()).rejects.toThrow(UnprocessableEntityException)
      expect(statements.create).not.toHaveBeenCalled()
    })

    it('refuses a due date that falls before the cutoff', async () => {
      await expect(
        record({ dueDate: '2026-07-01T00:00:00.000Z' }),
      ).rejects.toThrow(UnprocessableEntityException)
    })

    it('audits the recording with actor and correlation id', async () => {
      await record()

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'credit_line_statement.recorded',
          resourceType: 'credit_line_statement',
          resourceId: 'stmt-1',
          actorUserId: 'user-1',
          correlationId: 'req-1',
        }),
      )
    })
  })

  describe('listLinesWithLatestStatement', () => {
    it('pairs each line with its newest statement', async () => {
      statements.listLatestPerLine.mockResolvedValue([statement()])

      const [row] = await service.listLinesWithLatestStatement('tenant-1')

      expect(row.latestStatement?.id).toBe('stmt-1')
      expect(row.availableMinor).toBe(400000)
    })

    // Zero available and zero owed is a claim; "not known yet" is the truth,
    // and a board must not show the two the same way.
    it('reports nulls rather than zeros for a line with no statement yet', async () => {
      statements.listLatestPerLine.mockResolvedValue([])

      const [row] = await service.listLinesWithLatestStatement('tenant-1')

      expect(row.latestStatement).toBeNull()
      expect(row.availableMinor).toBeNull()
    })
  })

  describe('updateStatement', () => {
    const update = (overrides = {}) =>
      service.updateStatement({
        tenantId: 'tenant-1',
        actorUserId: 'user-1',
        correlationId: 'req-1',
        id: 'stmt-1',
        amountDueMinor: 250000,
        ...overrides,
      })

    it('corrects the statement, and its obligation with it', async () => {
      statements.update.mockResolvedValue(statement({ amountDueMinor: 250000 }))

      const view = await update()

      expect(statements.update).toHaveBeenCalledWith('stmt-1', 'tenant-1', {
        dueDate: undefined,
        closingBalanceMinor: undefined,
        amountDueMinor: 250000,
      })
      expect(view.statement.amountDueMinor).toBe(250000)
    })

    // Lowering below what is already paid would report an overpayment the
    // household never made. Undo the payment first — the obligations module
    // already exposes that.
    it('refuses to lower the amount due below what has been paid', async () => {
      statements.findWithPayment.mockResolvedValue({
        statement: statement(),
        paidMinor: 300000,
      })

      await expect(update({ amountDueMinor: 250000 })).rejects.toThrow(
        UnprocessableEntityException,
      )
      expect(statements.update).not.toHaveBeenCalled()
    })

    it('allows lowering down to exactly what has been paid', async () => {
      statements.findWithPayment.mockResolvedValue({
        statement: statement(),
        paidMinor: 250000,
      })
      statements.update.mockResolvedValue(statement({ amountDueMinor: 250000 }))

      await expect(update({ amountDueMinor: 250000 })).resolves.toBeDefined()
    })

    // Either field may move on its own, so the pair is re-checked whichever
    // one the caller sent.
    it('refuses an amount due above the closing balance', async () => {
      await expect(update({ amountDueMinor: 900000 })).rejects.toThrow(
        UnprocessableEntityException,
      )
    })

    it('catches the same violation when the balance is the field that moved', async () => {
      await expect(
        update({ amountDueMinor: undefined, closingBalanceMinor: 100000 }),
      ).rejects.toThrow(UnprocessableEntityException)
    })

    it('refuses a due date moved before the cutoff', async () => {
      await expect(
        update({ amountDueMinor: undefined, dueDate: '2026-07-01T00:00:00.000Z' }),
      ).rejects.toThrow(UnprocessableEntityException)
    })

    it('raises a typed 404 when the statement is not the tenant’s', async () => {
      statements.findWithPayment.mockResolvedValue(null)

      await expect(update()).rejects.toThrow(NotFoundException)
    })

    it('does not audit a correction that did not happen', async () => {
      statements.findWithPayment.mockResolvedValue(null)

      await expect(update()).rejects.toThrow(NotFoundException)
      expect(audit.record).not.toHaveBeenCalled()
    })
  })
})
