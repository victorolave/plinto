import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotFoundException } from '@nestjs/common'
import { CreditLineService } from '../credit-line.service'

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

describe('CreditLineService', () => {
  let repo: {
    create: ReturnType<typeof vi.fn>
    findByIdForTenant: ReturnType<typeof vi.fn>
    listForTenant: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    setStatus: ReturnType<typeof vi.fn>
  }
  let audit: { record: ReturnType<typeof vi.fn> }
  let service: CreditLineService

  const create = (overrides = {}) =>
    service.createLine({
      tenantId: 'tenant-1',
      actorUserId: 'user-1',
      correlationId: 'req-1',
      name: 'ADDI',
      limitMinor: 1200000,
      currency: 'COP',
      ...overrides,
    })

  beforeEach(() => {
    repo = {
      create: vi.fn().mockResolvedValue(line()),
      findByIdForTenant: vi.fn().mockResolvedValue(line()),
      listForTenant: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue(line()),
      setStatus: vi.fn().mockResolvedValue(line({ status: 'closed' })),
    }
    audit = { record: vi.fn().mockResolvedValue(undefined) }

    service = new CreditLineService(repo as never, audit as never)
  })

  describe('createLine', () => {
    it('records the line with its ceiling', async () => {
      const created = await create()

      expect(repo.create).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        name: 'ADDI',
        limitMinor: 1200000,
        currency: 'COP',
      })
      expect(created.limitMinor).toBe(1200000)
    })

    it('audits the creation with actor and correlation id', async () => {
      await create()

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          actorUserId: 'user-1',
          action: 'credit_line.created',
          resourceType: 'credit_line',
          resourceId: 'line-addi',
          correlationId: 'req-1',
        }),
      )
    })

    // A suspended line still carries what the household owes. Refusing to
    // record it would push that debt out of view, which is the opposite of
    // what this feature is for.
    it('accepts a zero limit', async () => {
      repo.create.mockResolvedValue(line({ limitMinor: 0 }))

      const created = await create({ limitMinor: 0 })

      expect(created.limitMinor).toBe(0)
    })
  })

  describe('getLine', () => {
    it('raises a typed 404 when the line belongs to another tenant', async () => {
      repo.findByIdForTenant.mockResolvedValue(null)

      await expect(service.getLine('line-addi', 'tenant-2')).rejects.toThrow(NotFoundException)
    })
  })

  describe('updateLine', () => {
    const update = (overrides = {}) =>
      service.updateLine({
        tenantId: 'tenant-1',
        actorUserId: 'user-1',
        correlationId: 'req-1',
        id: 'line-addi',
        limitMinor: 2000000,
        ...overrides,
      })

    it('raises the ceiling without touching anything else', async () => {
      repo.update.mockResolvedValue(line({ limitMinor: 2000000 }))

      const updated = await update()

      expect(repo.update).toHaveBeenCalledWith('line-addi', 'tenant-1', {
        name: undefined,
        limitMinor: 2000000,
      })
      expect(updated.limitMinor).toBe(2000000)
    })

    it('raises a typed 404 when the line is not the tenant’s', async () => {
      repo.update.mockResolvedValue(null)

      await expect(update()).rejects.toThrow(NotFoundException)
    })

    it('does not audit an update that did not happen', async () => {
      repo.update.mockResolvedValue(null)

      await expect(update()).rejects.toThrow(NotFoundException)
      expect(audit.record).not.toHaveBeenCalled()
    })
  })

  describe('closeLine', () => {
    const close = () =>
      service.closeLine({
        tenantId: 'tenant-1',
        actorUserId: 'user-1',
        correlationId: 'req-1',
        id: 'line-addi',
      })

    // Closed, never deleted: the statements a line issued stay readable, and
    // so do the payments that settled them.
    it('closes the line rather than removing it', async () => {
      const closed = await close()

      expect(repo.setStatus).toHaveBeenCalledWith('line-addi', 'tenant-1', 'closed')
      expect(closed.status).toBe('closed')
    })

    it('audits the closure', async () => {
      await close()

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'credit_line.closed', resourceId: 'line-addi' }),
      )
    })

    it('raises a typed 404 when the line is not the tenant’s', async () => {
      repo.setStatus.mockResolvedValue(null)

      await expect(close()).rejects.toThrow(NotFoundException)
    })
  })
})
