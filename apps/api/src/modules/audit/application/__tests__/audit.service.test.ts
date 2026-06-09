import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuditService } from '../audit.service'
import { AuditEvent } from '../../domain/audit-event.entity'

const makeAuditEvent = (overrides?: Partial<AuditEvent>): AuditEvent => ({
  id: 'audit-1',
  tenantId: 'tenant-1',
  actorUserId: 'user-1',
  action: 'tenant.create',
  resourceType: 'tenant',
  resourceId: 'tenant-1',
  source: 'manual',
  correlationId: 'req-1',
  createdAt: new Date(),
  ...overrides,
})

const makeAuditRepo = () => ({
  create: vi.fn(),
})

describe('AuditService', () => {
  let auditRepo: ReturnType<typeof makeAuditRepo>
  let service: AuditService

  beforeEach(() => {
    auditRepo = makeAuditRepo()
    service = new AuditService(auditRepo as any)
  })

  describe('record', () => {
    it('calls repository create with all provided fields', async () => {
      const event = makeAuditEvent()
      auditRepo.create.mockResolvedValue(event)

      await service.record({
        tenantId: 'tenant-1',
        actorUserId: 'user-1',
        action: 'tenant.create',
        resourceType: 'tenant',
        resourceId: 'tenant-1',
        correlationId: 'req-1',
      })

      expect(auditRepo.create).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        actorUserId: 'user-1',
        action: 'tenant.create',
        resourceType: 'tenant',
        resourceId: 'tenant-1',
        source: 'manual',
        correlationId: 'req-1',
        metadata: null,
      })
    })

    it('defaults source to "manual" when not provided', async () => {
      auditRepo.create.mockResolvedValue(makeAuditEvent())

      await service.record({
        tenantId: 'tenant-1',
        action: 'some.action',
        resourceType: 'resource',
        correlationId: 'req-1',
      })

      expect(auditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'manual' }),
      )
    })

    it('uses provided source when given', async () => {
      auditRepo.create.mockResolvedValue(makeAuditEvent({ source: 'job' }))

      await service.record({
        tenantId: 'tenant-1',
        action: 'some.action',
        resourceType: 'resource',
        correlationId: 'req-1',
        source: 'job',
      })

      expect(auditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'job' }),
      )
    })

    it('uses provided source "import"', async () => {
      auditRepo.create.mockResolvedValue(makeAuditEvent({ source: 'import' }))

      await service.record({
        tenantId: 'tenant-1',
        action: 'some.action',
        resourceType: 'resource',
        correlationId: 'req-1',
        source: 'import',
      })

      expect(auditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'import' }),
      )
    })

    it('forwards actorUserId and resourceId untouched when omitted (undefined, not coerced)', async () => {
      auditRepo.create.mockResolvedValue(makeAuditEvent())

      await service.record({
        tenantId: 'tenant-1',
        action: 'action',
        resourceType: 'type',
        correlationId: 'req-1',
      })

      const arg = auditRepo.create.mock.calls[0][0]
      expect(arg.actorUserId).toBeUndefined()
      expect(arg.resourceId).toBeUndefined()
    })

    it('defaults metadata to null when not provided', async () => {
      auditRepo.create.mockResolvedValue(makeAuditEvent())

      await service.record({
        tenantId: 'tenant-1',
        action: 'action',
        resourceType: 'type',
        correlationId: 'req-1',
      })

      expect(auditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: null }),
      )
    })

    it('passes metadata when provided', async () => {
      const meta = { reason: 'test' }
      auditRepo.create.mockResolvedValue(makeAuditEvent())

      await service.record({
        tenantId: 'tenant-1',
        action: 'action',
        resourceType: 'type',
        correlationId: 'req-1',
        metadata: meta,
      })

      expect(auditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: meta }),
      )
    })

    it('returns the created audit event', async () => {
      const event = makeAuditEvent()
      auditRepo.create.mockResolvedValue(event)

      const result = await service.record({
        tenantId: 'tenant-1',
        action: 'action',
        resourceType: 'type',
        correlationId: 'req-1',
      })

      expect(result).toBe(event)
    })

    it('propagates repository errors', async () => {
      auditRepo.create.mockRejectedValue(new Error('DB error'))

      await expect(
        service.record({
          tenantId: 'tenant-1',
          action: 'action',
          resourceType: 'type',
          correlationId: 'req-1',
        }),
      ).rejects.toThrow('DB error')
    })
  })
})
