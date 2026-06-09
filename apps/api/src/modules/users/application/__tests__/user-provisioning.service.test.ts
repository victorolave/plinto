import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UserProvisioningService } from '../user-provisioning.service'
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

describe('UserProvisioningService', () => {
  let userRepo: ReturnType<typeof makeUserRepo>
  let service: UserProvisioningService

  beforeEach(() => {
    userRepo = makeUserRepo()
    service = new UserProvisioningService(userRepo as any)
  })

  describe('provisionUser', () => {
    it('returns the existing user when one is found by idpSub', async () => {
      const existing = makeUser()
      userRepo.findByIdpSub.mockResolvedValue(existing)

      const result = await service.provisionUser({
        idpSub: 'google|abc',
        email: 'alice@example.com',
      })

      expect(userRepo.findByIdpSub).toHaveBeenCalledWith('google|abc')
      expect(userRepo.create).not.toHaveBeenCalled()
      expect(result).toBe(existing)
    })

    it('creates a new user when none is found by idpSub (JIT provisioning)', async () => {
      const newUser = makeUser({ id: 'user-new' })
      userRepo.findByIdpSub.mockResolvedValue(null)
      userRepo.create.mockResolvedValue(newUser)

      const result = await service.provisionUser({
        idpSub: 'google|abc',
        email: 'alice@example.com',
        name: 'Alice',
      })

      expect(userRepo.findByIdpSub).toHaveBeenCalledWith('google|abc')
      expect(userRepo.create).toHaveBeenCalledWith({
        idpSub: 'google|abc',
        email: 'alice@example.com',
        name: 'Alice',
      })
      expect(result).toBe(newUser)
    })

    it('creates without name when name is omitted', async () => {
      const newUser = makeUser({ name: undefined })
      userRepo.findByIdpSub.mockResolvedValue(null)
      userRepo.create.mockResolvedValue(newUser)

      await service.provisionUser({ idpSub: 'google|abc', email: 'alice@example.com' })

      expect(userRepo.create).toHaveBeenCalledWith({
        idpSub: 'google|abc',
        email: 'alice@example.com',
        name: undefined,
      })
    })

    it('propagates repository errors', async () => {
      userRepo.findByIdpSub.mockRejectedValue(new Error('DB error'))

      await expect(
        service.provisionUser({ idpSub: 'google|abc', email: 'alice@example.com' }),
      ).rejects.toThrow('DB error')
    })
  })
})
