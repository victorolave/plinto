import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TenantService } from '../tenant.service'
import { Tenant } from '../../domain/tenant.entity'
import { Membership } from '../../../memberships/domain/membership.entity'

const makeTenant = (overrides?: Partial<Tenant>): Tenant => ({
  id: 'tenant-1',
  name: 'Acme Corp',
  baseCurrency: 'COP',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

const makeMembership = (overrides?: Partial<Membership>): Membership => ({
  id: 'mem-1',
  tenantId: 'tenant-1',
  userId: 'user-1',
  role: 'owner',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

const makeTenantRepo = () => ({
  create: vi.fn(),
  findById: vi.fn(),
  listByUserId: vi.fn(),
})

const makeMembershipRepo = () => ({
  create: vi.fn(),
  listByUserId: vi.fn(),
  isMember: vi.fn(),
  findByUserAndTenant: vi.fn(),
})

describe('TenantService', () => {
  let tenantRepository: ReturnType<typeof makeTenantRepo>
  let membershipRepository: ReturnType<typeof makeMembershipRepo>
  let service: TenantService

  beforeEach(() => {
    tenantRepository = makeTenantRepo()
    membershipRepository = makeMembershipRepo()
    service = new TenantService(tenantRepository as any, membershipRepository as any)
  })

  describe('listTenantsForUser', () => {
    it('lists the tenants and memberships for the given user', async () => {
      const tenants = [makeTenant()]
      const memberships = [makeMembership()]
      tenantRepository.listByUserId.mockResolvedValue(tenants)
      membershipRepository.listByUserId.mockResolvedValue(memberships)

      const result = await service.listTenantsForUser('user-1')

      expect(tenantRepository.listByUserId).toHaveBeenCalledWith('user-1')
      expect(membershipRepository.listByUserId).toHaveBeenCalledWith('user-1')
      expect(result).toEqual({ tenants, memberships })
    })

    it('returns empty lists when the user has no tenants', async () => {
      tenantRepository.listByUserId.mockResolvedValue([])
      membershipRepository.listByUserId.mockResolvedValue([])

      const result = await service.listTenantsForUser('user-2')

      expect(result).toEqual({ tenants: [], memberships: [] })
    })

    it('propagates repository errors', async () => {
      tenantRepository.listByUserId.mockRejectedValue(new Error('DB error'))

      await expect(service.listTenantsForUser('user-1')).rejects.toThrow('DB error')
    })
  })
})
