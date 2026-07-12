import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotFoundException } from '@nestjs/common'
import { UserProfileService } from '../user-profile.service'
import { User } from '../../domain/user.entity'

const makeUser = (overrides?: Partial<User>): User => ({
  id: 'user-1',
  idpSub: 'google|abc',
  email: 'alice@example.com',
  name: 'Alice',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

const makeUserRepo = () => ({
  findById: vi.fn(),
  findByIdpSub: vi.fn(),
  create: vi.fn(),
  updateName: vi.fn(),
})

const makeAuditService = () => ({
  record: vi.fn().mockResolvedValue(undefined),
})

const makeSessionService = () => ({
  getActiveTenant: vi.fn(),
  setActiveTenant: vi.fn(),
  autoSelectIfSingleTenant: vi.fn(),
})

describe('UserProfileService', () => {
  let userRepository: ReturnType<typeof makeUserRepo>
  let auditService: ReturnType<typeof makeAuditService>
  let sessionService: ReturnType<typeof makeSessionService>
  let service: UserProfileService

  beforeEach(() => {
    userRepository = makeUserRepo()
    auditService = makeAuditService()
    sessionService = makeSessionService()
    service = new UserProfileService(
      userRepository as any,
      auditService as any,
      sessionService as any,
    )
  })

  describe('getProfile', () => {
    it('returns the user by id', async () => {
      const user = makeUser()
      userRepository.findById.mockResolvedValue(user)

      const result = await service.getProfile('user-1')

      expect(userRepository.findById).toHaveBeenCalledWith('user-1')
      expect(result).toBe(user)
    })

    it('returns null when the user does not exist', async () => {
      userRepository.findById.mockResolvedValue(null)

      const result = await service.getProfile('missing')

      expect(result).toBeNull()
    })
  })

  describe('updateProfile', () => {
    it('updates the name and records an audit event scoped to the active tenant', async () => {
      const existing = makeUser({ name: 'Old Name' })
      const updated = makeUser({ name: 'New Name' })
      userRepository.findById.mockResolvedValue(existing)
      userRepository.updateName.mockResolvedValue(updated)
      sessionService.getActiveTenant.mockResolvedValue('tenant-1')

      const result = await service.updateProfile({
        userId: 'user-1',
        name: 'New Name',
        correlationId: 'corr-1',
      })

      expect(userRepository.updateName).toHaveBeenCalledWith('user-1', 'New Name')
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          actorUserId: 'user-1',
          action: 'user.profile.updated',
          resourceType: 'user',
          resourceId: updated.id,
          correlationId: 'corr-1',
          metadata: {
            before: { name: 'Old Name' },
            after: { name: 'New Name' },
          },
        }),
      )
      expect(result).toBe(updated)
    })

    it('throws USER_NOT_FOUND instead of letting a raw Prisma error bubble up', async () => {
      userRepository.findById.mockResolvedValue(null)

      await expect(
        service.updateProfile({
          userId: 'missing',
          name: 'New Name',
          correlationId: 'corr-1',
        }),
      ).rejects.toBeInstanceOf(NotFoundException)
      expect(userRepository.updateName).not.toHaveBeenCalled()
      expect(auditService.record).not.toHaveBeenCalled()
    })

    it('throws with the USER_NOT_FOUND code', async () => {
      userRepository.findById.mockResolvedValue(null)

      await expect(
        service.updateProfile({
          userId: 'missing',
          name: 'New Name',
          correlationId: 'corr-1',
        }),
      ).rejects.toMatchObject({
        response: { code: 'USER_NOT_FOUND' },
      })
    })

    it('skips audit recording when the user has no active tenant', async () => {
      const existing = makeUser({ name: 'Old Name' })
      const updated = makeUser({ name: 'New Name' })
      userRepository.findById.mockResolvedValue(existing)
      userRepository.updateName.mockResolvedValue(updated)
      sessionService.getActiveTenant.mockResolvedValue(null)

      const result = await service.updateProfile({
        userId: 'user-1',
        name: 'New Name',
        correlationId: 'corr-1',
      })

      expect(auditService.record).not.toHaveBeenCalled()
      expect(result).toBe(updated)
    })
  })
})
