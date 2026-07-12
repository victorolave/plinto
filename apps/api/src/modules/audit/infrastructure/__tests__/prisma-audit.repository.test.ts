import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'
import { PrismaAuditRepository } from '../prisma-audit.repository'
import type { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service'

const makePrisma = () => ({
  auditEvent: {
    create: vi.fn(),
  },
})

describe('PrismaAuditRepository', () => {
  let prisma: ReturnType<typeof makePrisma>
  let repository: PrismaAuditRepository

  beforeEach(() => {
    prisma = makePrisma()
    repository = new PrismaAuditRepository(prisma as unknown as PrismaService)
  })

  describe('create', () => {
    it('connects the tenant relation and forwards actor, action, resource, source, and correlation fields', async () => {
      const created = { id: 'audit-1', createdAt: new Date() }
      prisma.auditEvent.create.mockResolvedValue(created)

      const result = await repository.create({
        tenantId: 'tenant-1',
        actorUserId: 'user-1',
        action: 'account.created',
        resourceType: 'account',
        resourceId: 'account-1',
        source: 'manual',
        correlationId: 'corr-1',
        metadata: { foo: 'bar' },
      })

      expect(prisma.auditEvent.create).toHaveBeenCalledWith({
        data: {
          tenant: { connect: { id: 'tenant-1' } },
          actorUserId: 'user-1',
          action: 'account.created',
          resourceType: 'account',
          resourceId: 'account-1',
          source: 'manual',
          correlationId: 'corr-1',
          metadata: { foo: 'bar' },
        },
      })
      expect(result).toBe(created)
    })

    it('normalizes an omitted actorUserId and resourceId to null', async () => {
      prisma.auditEvent.create.mockResolvedValue({ id: 'audit-1', createdAt: new Date() })

      await repository.create({
        tenantId: 'tenant-1',
        action: 'job.ran',
        resourceType: 'job',
        source: 'job',
        correlationId: 'corr-2',
      })

      expect(prisma.auditEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorUserId: null,
          resourceId: null,
        }),
      })
    })

    it('normalizes an omitted metadata to Prisma.JsonNull', async () => {
      prisma.auditEvent.create.mockResolvedValue({ id: 'audit-1', createdAt: new Date() })

      await repository.create({
        tenantId: 'tenant-1',
        action: 'job.ran',
        resourceType: 'job',
        source: 'job',
        correlationId: 'corr-3',
      })

      expect(prisma.auditEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: Prisma.JsonNull,
        }),
      })
    })
  })
})
