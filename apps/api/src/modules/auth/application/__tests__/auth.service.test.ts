import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthService } from '../auth.service'
import { User } from '../../../users/domain/user.entity'
import { Membership } from '../../../memberships/domain/membership.entity'
import { Session } from '../../../sessions/domain/session.entity'

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

const makeMembership = (overrides?: Partial<Membership>): Membership => ({
  id: 'mem-1',
  tenantId: 'tenant-1',
  userId: 'user-1',
  role: 'owner',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

const makeSession = (overrides?: Partial<Session>): Session => ({
  id: 'session-1',
  userId: 'user-1',
  tenantId: 'tenant-1',
  createdAt: new Date(),
  expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  ...overrides,
})

// ---- mock factories ----

const makeUserProvisioningService = () => ({
  provisionUser: vi.fn(),
})

const makeUserRepo = () => ({
  findById: vi.fn(),
  findByIdpSub: vi.fn(),
  create: vi.fn(),
  updateName: vi.fn(),
})

const makeMembershipRepo = () => ({
  create: vi.fn(),
  listByUserId: vi.fn(),
  isMember: vi.fn(),
  findByUserAndTenant: vi.fn(),
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

describe('AuthService', () => {
  let userProvisioningService: ReturnType<typeof makeUserProvisioningService>
  let userRepo: ReturnType<typeof makeUserRepo>
  let membershipRepo: ReturnType<typeof makeMembershipRepo>
  let sessionRepo: ReturnType<typeof makeSessionRepo>
  let service: AuthService

  beforeEach(() => {
    userProvisioningService = makeUserProvisioningService()
    userRepo = makeUserRepo()
    membershipRepo = makeMembershipRepo()
    sessionRepo = makeSessionRepo()
    service = new AuthService(
      userProvisioningService as any,
      userRepo as any,
      membershipRepo as any,
      sessionRepo as any,
    )
  })

  // ---- createSession ----

  describe('createSession', () => {
    it('returns session, user, memberships, activeTenantId, and needsOnboarding=false for a fully-set-up user', async () => {
      const user = makeUser({ name: 'Alice' })
      const memberships = [makeMembership()]
      const session = makeSession({ tenantId: 'tenant-1' })

      userProvisioningService.provisionUser.mockResolvedValue(user)
      membershipRepo.listByUserId.mockResolvedValue(memberships)
      sessionRepo.getActiveTenantByUserId.mockResolvedValue('tenant-1')
      sessionRepo.create.mockResolvedValue(session)

      const result = await service.createSession({
        idpSub: 'google|abc',
        email: 'alice@example.com',
        name: 'Alice',
      })

      expect(result.user.id).toBe('user-1')
      expect(result.user.idpSub).toBe('google|abc')
      expect(result.memberships).toBe(memberships)
      expect(result.session).toBe(session)
      expect(result.needsOnboarding).toBe(false)
    })

    it('calls userProvisioningService.provisionUser with idpSub, email, name', async () => {
      const user = makeUser()
      userProvisioningService.provisionUser.mockResolvedValue(user)
      membershipRepo.listByUserId.mockResolvedValue([makeMembership()])
      sessionRepo.getActiveTenantByUserId.mockResolvedValue(null)
      sessionRepo.create.mockResolvedValue(makeSession())

      await service.createSession({
        idpSub: 'google|abc',
        email: 'alice@example.com',
        name: 'Alice',
      })

      expect(userProvisioningService.provisionUser).toHaveBeenCalledWith({
        idpSub: 'google|abc',
        email: 'alice@example.com',
        name: 'Alice',
      })
    })

    it('updates user name when user has no name but name is provided in params', async () => {
      const user = makeUser({ name: null })
      userProvisioningService.provisionUser.mockResolvedValue(user)
      membershipRepo.listByUserId.mockResolvedValue([makeMembership()])
      sessionRepo.getActiveTenantByUserId.mockResolvedValue(null)
      sessionRepo.create.mockResolvedValue(makeSession())
      userRepo.updateName.mockResolvedValue({ ...user, name: 'Alice' })

      await service.createSession({
        idpSub: 'google|abc',
        email: 'alice@example.com',
        name: 'Alice',
      })

      expect(userRepo.updateName).toHaveBeenCalledWith('user-1', 'Alice')
    })

    it('reflects the freshly-saved name in the response (needsOnboarding=false, user.name set)', async () => {
      // Regression: a nameless returning user logs in with a name in the IdP claims.
      // updateName persists it, so the response must NOT still report the stale null name
      // nor send the user back to onboarding.
      const user = makeUser({ name: null })
      const updatedUser = { ...user, name: 'Alice' }
      userProvisioningService.provisionUser.mockResolvedValue(user)
      membershipRepo.listByUserId.mockResolvedValue([makeMembership()])
      sessionRepo.getActiveTenantByUserId.mockResolvedValue('tenant-1')
      sessionRepo.create.mockResolvedValue(makeSession())
      userRepo.updateName.mockResolvedValue(updatedUser)

      const result = await service.createSession({
        idpSub: 'google|abc',
        email: 'alice@example.com',
        name: 'Alice',
      })

      expect(result.user.name).toBe('Alice')
      expect(result.needsOnboarding).toBe(false)
    })

    it('does NOT update user name when user already has a name', async () => {
      const user = makeUser({ name: 'Existing Name' })
      userProvisioningService.provisionUser.mockResolvedValue(user)
      membershipRepo.listByUserId.mockResolvedValue([makeMembership()])
      sessionRepo.getActiveTenantByUserId.mockResolvedValue(null)
      sessionRepo.create.mockResolvedValue(makeSession())

      await service.createSession({
        idpSub: 'google|abc',
        email: 'alice@example.com',
        name: 'New Name',
      })

      expect(userRepo.updateName).not.toHaveBeenCalled()
    })

    it('does NOT update user name when no name is provided in params', async () => {
      const user = makeUser({ name: null })
      userProvisioningService.provisionUser.mockResolvedValue(user)
      membershipRepo.listByUserId.mockResolvedValue([makeMembership()])
      sessionRepo.getActiveTenantByUserId.mockResolvedValue(null)
      sessionRepo.create.mockResolvedValue(makeSession())

      await service.createSession({ idpSub: 'google|abc', email: 'alice@example.com' })

      expect(userRepo.updateName).not.toHaveBeenCalled()
    })

    it('resolves activeTenantId from lastActiveTenant when user has a matching membership', async () => {
      const user = makeUser()
      userProvisioningService.provisionUser.mockResolvedValue(user)
      membershipRepo.listByUserId.mockResolvedValue([makeMembership({ tenantId: 'tenant-1' })])
      sessionRepo.getActiveTenantByUserId.mockResolvedValue('tenant-1')
      sessionRepo.create.mockResolvedValue(makeSession({ tenantId: 'tenant-1' }))

      const result = await service.createSession({
        idpSub: 'google|abc',
        email: 'alice@example.com',
      })

      expect(result.activeTenantId).toBe('tenant-1')
    })

    it('falls back to single membership auto-selection when lastActiveTenant is not in memberships', async () => {
      const user = makeUser()
      userProvisioningService.provisionUser.mockResolvedValue(user)
      membershipRepo.listByUserId.mockResolvedValue([makeMembership({ tenantId: 'tenant-1' })])
      // getActiveTenantByUserId returns a tenant the user no longer belongs to
      sessionRepo.getActiveTenantByUserId.mockResolvedValue('tenant-stale')
      sessionRepo.create.mockResolvedValue(makeSession({ tenantId: 'tenant-1' }))

      const result = await service.createSession({
        idpSub: 'google|abc',
        email: 'alice@example.com',
      })

      expect(result.activeTenantId).toBe('tenant-1')
    })

    it('sets activeTenantId to null when user has zero memberships', async () => {
      const user = makeUser()
      userProvisioningService.provisionUser.mockResolvedValue(user)
      membershipRepo.listByUserId.mockResolvedValue([])
      sessionRepo.getActiveTenantByUserId.mockResolvedValue(null)
      sessionRepo.create.mockResolvedValue(makeSession({ tenantId: null }))

      const result = await service.createSession({
        idpSub: 'google|abc',
        email: 'alice@example.com',
      })

      expect(result.activeTenantId).toBeNull()
    })

    it('sets activeTenantId to null when user has multiple memberships and no valid lastActiveTenant', async () => {
      const user = makeUser()
      userProvisioningService.provisionUser.mockResolvedValue(user)
      membershipRepo.listByUserId.mockResolvedValue([
        makeMembership({ tenantId: 'tenant-1' }),
        makeMembership({ id: 'mem-2', tenantId: 'tenant-2' }),
      ])
      sessionRepo.getActiveTenantByUserId.mockResolvedValue(null)
      sessionRepo.create.mockResolvedValue(makeSession({ tenantId: null }))

      const result = await service.createSession({
        idpSub: 'google|abc',
        email: 'alice@example.com',
      })

      expect(result.activeTenantId).toBeNull()
    })

    it('needsOnboarding is true when user has no name', async () => {
      const user = makeUser({ name: null })
      userProvisioningService.provisionUser.mockResolvedValue(user)
      membershipRepo.listByUserId.mockResolvedValue([makeMembership()])
      sessionRepo.getActiveTenantByUserId.mockResolvedValue(null)
      sessionRepo.create.mockResolvedValue(makeSession())

      const result = await service.createSession({
        idpSub: 'google|abc',
        email: 'alice@example.com',
      })

      expect(result.needsOnboarding).toBe(true)
    })

    it('needsOnboarding is true when user has no memberships', async () => {
      const user = makeUser({ name: 'Alice' })
      userProvisioningService.provisionUser.mockResolvedValue(user)
      membershipRepo.listByUserId.mockResolvedValue([])
      sessionRepo.getActiveTenantByUserId.mockResolvedValue(null)
      sessionRepo.create.mockResolvedValue(makeSession({ tenantId: null }))

      const result = await service.createSession({
        idpSub: 'google|abc',
        email: 'alice@example.com',
      })

      expect(result.needsOnboarding).toBe(true)
    })

    it('needsOnboarding is false when user has name and at least one membership', async () => {
      const user = makeUser({ name: 'Alice' })
      userProvisioningService.provisionUser.mockResolvedValue(user)
      membershipRepo.listByUserId.mockResolvedValue([makeMembership()])
      sessionRepo.getActiveTenantByUserId.mockResolvedValue('tenant-1')
      sessionRepo.create.mockResolvedValue(makeSession())

      const result = await service.createSession({
        idpSub: 'google|abc',
        email: 'alice@example.com',
      })

      expect(result.needsOnboarding).toBe(false)
    })

    it('creates session with correct expiresAt (approx 30 minutes from now)', async () => {
      const beforeCall = Date.now()
      const user = makeUser()
      userProvisioningService.provisionUser.mockResolvedValue(user)
      membershipRepo.listByUserId.mockResolvedValue([])
      sessionRepo.getActiveTenantByUserId.mockResolvedValue(null)
      sessionRepo.create.mockImplementation(async (data) => makeSession({ expiresAt: data.expiresAt }))

      await service.createSession({ idpSub: 'google|abc', email: 'alice@example.com' })

      const afterCall = Date.now()
      const callArgs = sessionRepo.create.mock.calls[0][0]
      const expiresMs = callArgs.expiresAt.getTime()

      expect(expiresMs).toBeGreaterThanOrEqual(beforeCall + 30 * 60 * 1000 - 100)
      expect(expiresMs).toBeLessThanOrEqual(afterCall + 30 * 60 * 1000 + 100)
    })

    it('passes userAgent and ipAddress through to session creation', async () => {
      const user = makeUser()
      userProvisioningService.provisionUser.mockResolvedValue(user)
      membershipRepo.listByUserId.mockResolvedValue([])
      sessionRepo.getActiveTenantByUserId.mockResolvedValue(null)
      sessionRepo.create.mockResolvedValue(makeSession())

      await service.createSession({
        idpSub: 'google|abc',
        email: 'alice@example.com',
        userAgent: 'Mozilla/5.0',
        ipAddress: '127.0.0.1',
      })

      expect(sessionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userAgent: 'Mozilla/5.0',
          ipAddress: '127.0.0.1',
        }),
      )
    })

    it('propagates userProvisioningService errors', async () => {
      userProvisioningService.provisionUser.mockRejectedValue(new Error('Provisioning failed'))

      await expect(
        service.createSession({ idpSub: 'google|abc', email: 'alice@example.com' }),
      ).rejects.toThrow('Provisioning failed')
    })

    it('propagates membershipRepository errors', async () => {
      userProvisioningService.provisionUser.mockResolvedValue(makeUser())
      membershipRepo.listByUserId.mockRejectedValue(new Error('Membership DB error'))

      await expect(
        service.createSession({ idpSub: 'google|abc', email: 'alice@example.com' }),
      ).rejects.toThrow('Membership DB error')
    })

    it('propagates getActiveTenantByUserId errors', async () => {
      userProvisioningService.provisionUser.mockResolvedValue(makeUser())
      membershipRepo.listByUserId.mockResolvedValue([makeMembership()])
      sessionRepo.getActiveTenantByUserId.mockRejectedValue(new Error('Active tenant error'))

      await expect(
        service.createSession({ idpSub: 'google|abc', email: 'alice@example.com' }),
      ).rejects.toThrow('Active tenant error')
    })

    it('propagates sessionRepository.create errors', async () => {
      userProvisioningService.provisionUser.mockResolvedValue(makeUser())
      membershipRepo.listByUserId.mockResolvedValue([makeMembership()])
      sessionRepo.getActiveTenantByUserId.mockResolvedValue(null)
      sessionRepo.create.mockRejectedValue(new Error('Session create error'))

      await expect(
        service.createSession({ idpSub: 'google|abc', email: 'alice@example.com' }),
      ).rejects.toThrow('Session create error')
    })
  })

  // ---- revokeSession ----

  describe('revokeSession', () => {
    it('calls sessionRepository.revoke with the given sessionId', async () => {
      sessionRepo.revoke.mockResolvedValue(undefined)

      await service.revokeSession('session-1')

      expect(sessionRepo.revoke).toHaveBeenCalledWith('session-1')
    })

    it('propagates revoke errors', async () => {
      sessionRepo.revoke.mockRejectedValue(new Error('Revoke failed'))

      await expect(service.revokeSession('session-1')).rejects.toThrow('Revoke failed')
    })
  })
})
