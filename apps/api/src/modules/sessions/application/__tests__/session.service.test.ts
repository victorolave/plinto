import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SessionService } from '../session.service'
import { Membership } from '../../../memberships/domain/membership.entity'

const makeMembership = (overrides?: Partial<Membership>): Membership => ({
  id: 'mem-1',
  tenantId: 'tenant-1',
  userId: 'user-1',
  role: 'owner',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

const makeSessionRepo = () => ({
  create: vi.fn(),
  findById: vi.fn(),
  findActiveById: vi.fn(),
  updateActiveTenant: vi.fn(),
  updateActiveTenantForUser: vi.fn(),
  revoke: vi.fn(),
  getActiveTenantByUserId: vi.fn(),
})

const makeMembershipRepo = () => ({
  create: vi.fn(),
  listByUserId: vi.fn(),
  isMember: vi.fn(),
  findByUserAndTenant: vi.fn(),
})

describe('SessionService', () => {
  let sessionRepo: ReturnType<typeof makeSessionRepo>
  let membershipRepo: ReturnType<typeof makeMembershipRepo>
  let service: SessionService

  beforeEach(() => {
    sessionRepo = makeSessionRepo()
    membershipRepo = makeMembershipRepo()
    service = new SessionService(sessionRepo as any, membershipRepo as any)
  })

  describe('getActiveTenant', () => {
    it('delegates to sessionRepository.getActiveTenantByUserId', async () => {
      sessionRepo.getActiveTenantByUserId.mockResolvedValue('tenant-1')

      const result = await service.getActiveTenant('user-1')

      expect(sessionRepo.getActiveTenantByUserId).toHaveBeenCalledWith('user-1')
      expect(result).toBe('tenant-1')
    })

    it('returns null when no active tenant found', async () => {
      sessionRepo.getActiveTenantByUserId.mockResolvedValue(null)

      const result = await service.getActiveTenant('user-1')

      expect(result).toBeNull()
    })
  })

  describe('setActiveTenant', () => {
    it('delegates to sessionRepository.updateActiveTenantForUser', async () => {
      sessionRepo.updateActiveTenantForUser.mockResolvedValue(undefined)

      await service.setActiveTenant('user-1', 'tenant-1')

      expect(sessionRepo.updateActiveTenantForUser).toHaveBeenCalledWith('user-1', 'tenant-1')
    })

    it('accepts null to clear active tenant', async () => {
      sessionRepo.updateActiveTenantForUser.mockResolvedValue(undefined)

      await service.setActiveTenant('user-1', null)

      expect(sessionRepo.updateActiveTenantForUser).toHaveBeenCalledWith('user-1', null)
    })
  })

  describe('autoSelectIfSingleTenant', () => {
    it('sets and returns the membership tenantId when user has exactly one membership', async () => {
      // Fixture id differs from any hard-coded value so a copy-paste/literal bug would surface.
      const membership = makeMembership({ tenantId: 'tenant-xyz' })
      membershipRepo.listByUserId.mockResolvedValue([membership])
      sessionRepo.updateActiveTenantForUser.mockResolvedValue(undefined)

      const result = await service.autoSelectIfSingleTenant('user-1')

      expect(membershipRepo.listByUserId).toHaveBeenCalledWith('user-1')
      expect(sessionRepo.updateActiveTenantForUser).toHaveBeenCalledWith('user-1', 'tenant-xyz')
      expect(result).toBe('tenant-xyz')
    })

    it('returns null and does NOT call setActiveTenant when user has zero memberships', async () => {
      membershipRepo.listByUserId.mockResolvedValue([])

      const result = await service.autoSelectIfSingleTenant('user-1')

      expect(sessionRepo.updateActiveTenantForUser).not.toHaveBeenCalled()
      expect(result).toBeNull()
    })

    it('returns null and does NOT call setActiveTenant when user has multiple memberships', async () => {
      membershipRepo.listByUserId.mockResolvedValue([
        makeMembership({ tenantId: 'tenant-1' }),
        makeMembership({ id: 'mem-2', tenantId: 'tenant-2' }),
      ])

      const result = await service.autoSelectIfSingleTenant('user-1')

      expect(sessionRepo.updateActiveTenantForUser).not.toHaveBeenCalled()
      expect(result).toBeNull()
    })

    it('propagates membership repository errors', async () => {
      membershipRepo.listByUserId.mockRejectedValue(new Error('DB error'))

      await expect(service.autoSelectIfSingleTenant('user-1')).rejects.toThrow('DB error')
    })
  })
})
