import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PrismaSessionRepository } from '../prisma-session.repository'
import type { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service'

const makePrisma = () => ({
  session: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
})

const makeSession = (overrides = {}) => ({
  id: 'session-1',
  userId: 'user-1',
  tenantId: 'tenant-1',
  createdAt: new Date(),
  expiresAt: new Date('2026-08-01T00:00:00.000Z'),
  revokedAt: null,
  lastSeenAt: null,
  userAgent: 'test-agent',
  ipAddress: '127.0.0.1',
  ...overrides,
})

describe('PrismaSessionRepository', () => {
  let prisma: ReturnType<typeof makePrisma>
  let repository: PrismaSessionRepository

  beforeEach(() => {
    prisma = makePrisma()
    repository = new PrismaSessionRepository(prisma as unknown as PrismaService)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('create', () => {
    it('creates the session with the given fields', async () => {
      const session = makeSession()
      prisma.session.create.mockResolvedValue(session)

      const result = await repository.create({
        userId: 'user-1',
        tenantId: 'tenant-1',
        expiresAt: session.expiresAt,
        userAgent: 'test-agent',
        ipAddress: '127.0.0.1',
      })

      expect(prisma.session.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          tenantId: 'tenant-1',
          expiresAt: session.expiresAt,
          userAgent: 'test-agent',
          ipAddress: '127.0.0.1',
        },
      })
      expect(result).toBe(session)
    })
  })

  describe('findById', () => {
    it('looks up the session by id', async () => {
      const session = makeSession()
      prisma.session.findUnique.mockResolvedValue(session)

      const result = await repository.findById('session-1')

      expect(prisma.session.findUnique).toHaveBeenCalledWith({ where: { id: 'session-1' } })
      expect(result).toBe(session)
    })
  })

  describe('findActiveById', () => {
    it('filters by id, non-revoked, and not-yet-expired using the current time', async () => {
      const now = new Date('2026-07-12T10:00:00.000Z')
      vi.useFakeTimers()
      vi.setSystemTime(now)
      prisma.session.findFirst.mockResolvedValue(makeSession())

      await repository.findActiveById('session-1')

      expect(prisma.session.findFirst).toHaveBeenCalledWith({
        where: { id: 'session-1', revokedAt: null, expiresAt: { gt: now } },
      })
    })

    it('returns null when no active session matches', async () => {
      prisma.session.findFirst.mockResolvedValue(null)

      const result = await repository.findActiveById('session-1')

      expect(result).toBeNull()
    })
  })

  describe('extendExpiry', () => {
    it('updates the expiresAt of the session matched by id', async () => {
      const expiresAt = new Date('2026-09-01T00:00:00.000Z')
      const session = makeSession({ expiresAt })
      prisma.session.update.mockResolvedValue(session)

      const result = await repository.extendExpiry('session-1', expiresAt)

      expect(prisma.session.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: { expiresAt },
      })
      expect(result).toBe(session)
    })
  })

  describe('updateActiveTenant', () => {
    it('updates the tenantId of the session matched by id', async () => {
      const session = makeSession({ tenantId: 'tenant-2' })
      prisma.session.update.mockResolvedValue(session)

      const result = await repository.updateActiveTenant('session-1', 'tenant-2')

      expect(prisma.session.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: { tenantId: 'tenant-2' },
      })
      expect(result).toBe(session)
    })

    it('allows clearing the active tenant with null', async () => {
      const session = makeSession({ tenantId: null })
      prisma.session.update.mockResolvedValue(session)

      await repository.updateActiveTenant('session-1', null)

      expect(prisma.session.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: { tenantId: null },
      })
    })
  })

  describe('updateActiveTenantForUser', () => {
    it('updates all non-revoked sessions for the user', async () => {
      prisma.session.updateMany.mockResolvedValue({ count: 2 })

      const result = await repository.updateActiveTenantForUser('user-1', 'tenant-2')

      expect(prisma.session.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { tenantId: 'tenant-2' },
      })
      expect(result).toEqual({ count: 2 })
    })
  })

  describe('revoke', () => {
    it('sets revokedAt on the session matched by id', async () => {
      const now = new Date('2026-07-12T10:00:00.000Z')
      vi.useFakeTimers()
      vi.setSystemTime(now)
      const session = makeSession({ revokedAt: now })
      prisma.session.update.mockResolvedValue(session)

      const result = await repository.revoke('session-1')

      expect(prisma.session.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: { revokedAt: now },
      })
      expect(result).toBe(session)
    })
  })

  describe('getActiveTenantByUserId', () => {
    it('finds the most recent active session for the user and returns its tenantId', async () => {
      const now = new Date('2026-07-12T10:00:00.000Z')
      vi.useFakeTimers()
      vi.setSystemTime(now)
      prisma.session.findFirst.mockResolvedValue(makeSession({ tenantId: 'tenant-9' }))

      const result = await repository.getActiveTenantByUserId('user-1')

      expect(prisma.session.findFirst).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null, expiresAt: { gt: now } },
        orderBy: { createdAt: 'desc' },
      })
      expect(result).toBe('tenant-9')
    })

    it('returns null when there is no active session', async () => {
      prisma.session.findFirst.mockResolvedValue(null)

      const result = await repository.getActiveTenantByUserId('user-1')

      expect(result).toBeNull()
    })

    it('normalizes an undefined tenantId on the session to null', async () => {
      prisma.session.findFirst.mockResolvedValue(makeSession({ tenantId: undefined }))

      const result = await repository.getActiveTenantByUserId('user-1')

      expect(result).toBeNull()
    })
  })
})
