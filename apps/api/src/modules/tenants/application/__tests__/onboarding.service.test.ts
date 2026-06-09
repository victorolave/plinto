import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OnboardingService } from '../onboarding.service'
import { User } from '../../../users/domain/user.entity'
import { Tenant } from '../../domain/tenant.entity'
import { Membership } from '../../../memberships/domain/membership.entity'

// ---- factory helpers ----

const makeUser = (overrides?: Partial<User>): User => ({
  id: 'user-1',
  idpSub: 'google|abc',
  email: 'alice@example.com',
  name: 'Alice',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

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

// ---- mock factories ----

const makeUserRepo = () => ({
  findById: vi.fn(),
  findByIdpSub: vi.fn(),
  create: vi.fn(),
  updateName: vi.fn(),
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

const makeAuditService = () => ({
  record: vi.fn(),
})

const makeSessionService = () => ({
  getActiveTenant: vi.fn(),
  setActiveTenant: vi.fn(),
  autoSelectIfSingleTenant: vi.fn(),
})

describe('OnboardingService', () => {
  let userRepo: ReturnType<typeof makeUserRepo>
  let tenantRepo: ReturnType<typeof makeTenantRepo>
  let membershipRepo: ReturnType<typeof makeMembershipRepo>
  let auditService: ReturnType<typeof makeAuditService>
  let sessionService: ReturnType<typeof makeSessionService>
  let service: OnboardingService

  beforeEach(() => {
    userRepo = makeUserRepo()
    tenantRepo = makeTenantRepo()
    membershipRepo = makeMembershipRepo()
    auditService = makeAuditService()
    sessionService = makeSessionService()
    service = new OnboardingService(
      userRepo as any,
      tenantRepo as any,
      membershipRepo as any,
      auditService as any,
      sessionService as any,
    )
  })

  describe('completeOnboarding', () => {
    const baseParams = {
      userId: 'user-1',
      tenantName: 'Acme Corp',
      requestId: 'req-1',
    }

    it('creates a tenant, owner membership, and sets active tenant', async () => {
      const user = makeUser()
      const tenant = makeTenant()
      const membership = makeMembership()

      userRepo.findById.mockResolvedValue(user)
      tenantRepo.create.mockResolvedValue(tenant)
      membershipRepo.create.mockResolvedValue(membership)
      sessionService.setActiveTenant.mockResolvedValue(undefined)
      auditService.record.mockResolvedValue(undefined)

      const result = await service.completeOnboarding(baseParams)

      expect(result.tenant).toBe(tenant)
      expect(result.membership).toBe(membership)
    })

    it('assigns the "owner" role to the membership', async () => {
      const user = makeUser()
      const tenant = makeTenant()
      userRepo.findById.mockResolvedValue(user)
      tenantRepo.create.mockResolvedValue(tenant)
      membershipRepo.create.mockResolvedValue(makeMembership())
      sessionService.setActiveTenant.mockResolvedValue(undefined)
      auditService.record.mockResolvedValue(undefined)

      await service.completeOnboarding(baseParams)

      expect(membershipRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'owner' }),
      )
    })

    it('uses DEFAULT_BASE_CURRENCY (COP) when baseCurrency is not provided', async () => {
      const user = makeUser()
      const tenant = makeTenant({ baseCurrency: 'COP' })
      userRepo.findById.mockResolvedValue(user)
      tenantRepo.create.mockResolvedValue(tenant)
      membershipRepo.create.mockResolvedValue(makeMembership())
      sessionService.setActiveTenant.mockResolvedValue(undefined)
      auditService.record.mockResolvedValue(undefined)

      await service.completeOnboarding({ ...baseParams })

      expect(tenantRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ baseCurrency: 'COP' }),
      )
    })

    it('uses provided baseCurrency over the default', async () => {
      const user = makeUser()
      const tenant = makeTenant({ baseCurrency: 'USD' })
      userRepo.findById.mockResolvedValue(user)
      tenantRepo.create.mockResolvedValue(tenant)
      membershipRepo.create.mockResolvedValue(makeMembership())
      sessionService.setActiveTenant.mockResolvedValue(undefined)
      auditService.record.mockResolvedValue(undefined)

      await service.completeOnboarding({ ...baseParams, baseCurrency: 'USD' })

      expect(tenantRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ baseCurrency: 'USD' }),
      )
    })

    it('trims whitespace from baseCurrency before using it', async () => {
      const user = makeUser()
      const tenant = makeTenant({ baseCurrency: 'EUR' })
      userRepo.findById.mockResolvedValue(user)
      tenantRepo.create.mockResolvedValue(tenant)
      membershipRepo.create.mockResolvedValue(makeMembership())
      sessionService.setActiveTenant.mockResolvedValue(undefined)
      auditService.record.mockResolvedValue(undefined)

      await service.completeOnboarding({ ...baseParams, baseCurrency: '  EUR  ' })

      expect(tenantRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ baseCurrency: 'EUR' }),
      )
    })

    it('falls back to default currency when baseCurrency trims to empty string', async () => {
      const user = makeUser()
      const tenant = makeTenant({ baseCurrency: 'COP' })
      userRepo.findById.mockResolvedValue(user)
      tenantRepo.create.mockResolvedValue(tenant)
      membershipRepo.create.mockResolvedValue(makeMembership())
      sessionService.setActiveTenant.mockResolvedValue(undefined)
      auditService.record.mockResolvedValue(undefined)

      await service.completeOnboarding({ ...baseParams, baseCurrency: '   ' })

      expect(tenantRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ baseCurrency: 'COP' }),
      )
    })

    it('calls userRepository.updateName when profileName is provided', async () => {
      const user = makeUser()
      const tenant = makeTenant()
      userRepo.updateName.mockResolvedValue({ ...user, name: 'New Name' })
      userRepo.findById.mockResolvedValue({ ...user, name: 'New Name' })
      tenantRepo.create.mockResolvedValue(tenant)
      membershipRepo.create.mockResolvedValue(makeMembership())
      sessionService.setActiveTenant.mockResolvedValue(undefined)
      auditService.record.mockResolvedValue(undefined)

      await service.completeOnboarding({ ...baseParams, profileName: 'New Name' })

      expect(userRepo.updateName).toHaveBeenCalledWith('user-1', 'New Name')
    })

    it('does NOT call userRepository.updateName when profileName is not provided', async () => {
      const user = makeUser()
      userRepo.findById.mockResolvedValue(user)
      tenantRepo.create.mockResolvedValue(makeTenant())
      membershipRepo.create.mockResolvedValue(makeMembership())
      sessionService.setActiveTenant.mockResolvedValue(undefined)
      auditService.record.mockResolvedValue(undefined)

      await service.completeOnboarding(baseParams)

      expect(userRepo.updateName).not.toHaveBeenCalled()
    })

    it('throws PROFILE_REQUIRED when user has no name after optional update', async () => {
      const userWithoutName = makeUser({ name: null })
      userRepo.findById.mockResolvedValue(userWithoutName)

      await expect(service.completeOnboarding(baseParams)).rejects.toMatchObject({
        response: { code: 'PROFILE_REQUIRED' },
      })
    })

    it('calls setActiveTenant for the newly created tenant', async () => {
      const user = makeUser()
      const tenant = makeTenant({ id: 'tenant-new' })
      userRepo.findById.mockResolvedValue(user)
      tenantRepo.create.mockResolvedValue(tenant)
      membershipRepo.create.mockResolvedValue(makeMembership({ tenantId: 'tenant-new' }))
      sessionService.setActiveTenant.mockResolvedValue(undefined)
      auditService.record.mockResolvedValue(undefined)

      await service.completeOnboarding(baseParams)

      expect(sessionService.setActiveTenant).toHaveBeenCalledWith('user-1', 'tenant-new')
    })

    it('records two audit events: tenant.create and membership.create', async () => {
      const user = makeUser()
      const tenant = makeTenant({ id: 'tenant-1' })
      const membership = makeMembership({ id: 'mem-1', tenantId: 'tenant-1' })
      userRepo.findById.mockResolvedValue(user)
      tenantRepo.create.mockResolvedValue(tenant)
      membershipRepo.create.mockResolvedValue(membership)
      sessionService.setActiveTenant.mockResolvedValue(undefined)
      auditService.record.mockResolvedValue(undefined)

      await service.completeOnboarding({ ...baseParams, requestId: 'req-1' })

      expect(auditService.record).toHaveBeenCalledTimes(2)

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          actorUserId: 'user-1',
          action: 'tenant.create',
          resourceType: 'tenant',
          resourceId: 'tenant-1',
          correlationId: 'req-1',
        }),
      )

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          actorUserId: 'user-1',
          action: 'membership.create',
          resourceType: 'membership',
          resourceId: 'mem-1',
          correlationId: 'req-1',
        }),
      )
    })

    it('propagates tenant repository errors', async () => {
      const user = makeUser()
      userRepo.findById.mockResolvedValue(user)
      tenantRepo.create.mockRejectedValue(new Error('DB error'))

      await expect(service.completeOnboarding(baseParams)).rejects.toThrow('DB error')
    })
  })
})
