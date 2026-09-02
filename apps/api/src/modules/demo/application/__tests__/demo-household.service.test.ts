import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { DemoHouseholdService } from '../demo-household.service'
import { DemoTenantAlreadyExistsError } from '../../domain/demo-household.repository'
import type { DemoHouseholdRepository } from '../../domain/demo-household.repository'
import type { TenantRepository } from '../../../tenants/domain/tenant.repository'
import type { MembershipRepository } from '../../../memberships/domain/membership.repository'
import type { SessionService } from '../../../sessions/application/session.service'
import type { SessionRepository } from '../../../sessions/domain/session.repository'
import type { AuditService } from '../../../audit/application/audit.service'

const NOW = new Date(Date.UTC(2026, 8, 2, 12, 0, 0))

function makeTenant(overrides = {}) {
  return {
    id: 'tenant-1',
    name: 'Hogar de ejemplo',
    baseCurrency: 'COP',
    isDemo: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('DemoHouseholdService', () => {
  let demoHouseholdRepository: {
    createDemoHousehold: ReturnType<typeof vi.fn>
    deleteDemoHousehold: ReturnType<typeof vi.fn>
  }
  let tenantRepository: {
    findDemoTenantForOwner: ReturnType<typeof vi.fn>
    findById: ReturnType<typeof vi.fn>
  }
  let membershipRepository: { findByUserAndTenant: ReturnType<typeof vi.fn> }
  let sessionService: { setActiveTenant: ReturnType<typeof vi.fn> }
  let sessionRepository: { clearActiveTenantForUser: ReturnType<typeof vi.fn> }
  let auditService: { record: ReturnType<typeof vi.fn> }
  let service: DemoHouseholdService

  beforeEach(() => {
    demoHouseholdRepository = {
      createDemoHousehold: vi.fn(),
      deleteDemoHousehold: vi.fn(),
    }
    tenantRepository = {
      findDemoTenantForOwner: vi.fn(),
      findById: vi.fn(),
    }
    membershipRepository = { findByUserAndTenant: vi.fn() }
    sessionService = { setActiveTenant: vi.fn() }
    sessionRepository = { clearActiveTenantForUser: vi.fn() }
    auditService = { record: vi.fn() }

    service = new DemoHouseholdService(
      demoHouseholdRepository as unknown as DemoHouseholdRepository,
      tenantRepository as unknown as TenantRepository,
      membershipRepository as unknown as MembershipRepository,
      sessionService as unknown as SessionService,
      sessionRepository as unknown as SessionRepository,
      auditService as unknown as AuditService,
    )
  })

  describe('createForUser', () => {
    it('rejects with DEMO_TENANT_EXISTS when the user already owns a demo tenant', async () => {
      tenantRepository.findDemoTenantForOwner.mockResolvedValue(makeTenant())

      await expect(
        service.createForUser({ userId: 'user-1', correlationId: 'req-1', now: NOW }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'DEMO_TENANT_EXISTS' }),
      })
      expect(demoHouseholdRepository.createDemoHousehold).not.toHaveBeenCalled()
    })

    it('rejects with DEMO_TENANT_EXISTS when the repository loses the race under its advisory lock — the second caller', async () => {
      // The fast-path check passed (no demo tenant yet from this service's own
      // point of view), but the repository's transaction-scoped re-check under
      // the advisory lock found one a concurrent caller committed first.
      tenantRepository.findDemoTenantForOwner.mockResolvedValue(null)
      demoHouseholdRepository.createDemoHousehold.mockRejectedValue(
        new DemoTenantAlreadyExistsError('user-1'),
      )

      await expect(
        service.createForUser({ userId: 'user-1', correlationId: 'req-1', now: NOW }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'DEMO_TENANT_EXISTS' }),
      })
      expect(sessionService.setActiveTenant).not.toHaveBeenCalled()
      expect(auditService.record).not.toHaveBeenCalled()
    })

    it('creates the household once, defaults to es and "Hogar de ejemplo"', async () => {
      tenantRepository.findDemoTenantForOwner.mockResolvedValue(null)
      const tenant = makeTenant()
      demoHouseholdRepository.createDemoHousehold.mockResolvedValue({
        tenant,
        membership: { id: 'm-1', tenantId: tenant.id, userId: 'user-1', role: 'owner' },
      })

      const result = await service.createForUser({ userId: 'user-1', correlationId: 'req-1', now: NOW })

      expect(demoHouseholdRepository.createDemoHousehold).toHaveBeenCalledTimes(1)
      expect(demoHouseholdRepository.createDemoHousehold).toHaveBeenCalledWith({
        ownerUserId: 'user-1',
        tenantName: 'Hogar de ejemplo',
        locale: 'es',
        now: NOW,
      })
      expect(result).toBe(tenant)
    })

    it('uses the English name when locale is "en"', async () => {
      tenantRepository.findDemoTenantForOwner.mockResolvedValue(null)
      const tenant = makeTenant({ name: 'Example household' })
      demoHouseholdRepository.createDemoHousehold.mockResolvedValue({
        tenant,
        membership: { id: 'm-1', tenantId: tenant.id, userId: 'user-1', role: 'owner' },
      })

      await service.createForUser({ userId: 'user-1', locale: 'en', correlationId: 'req-1', now: NOW })

      expect(demoHouseholdRepository.createDemoHousehold).toHaveBeenCalledWith(
        expect.objectContaining({ tenantName: 'Example household', locale: 'en' }),
      )
    })

    it('switches the active tenant to the new demo household and records an audit event', async () => {
      tenantRepository.findDemoTenantForOwner.mockResolvedValue(null)
      const tenant = makeTenant()
      demoHouseholdRepository.createDemoHousehold.mockResolvedValue({
        tenant,
        membership: { id: 'm-1', tenantId: tenant.id, userId: 'user-1', role: 'owner' },
      })

      await service.createForUser({ userId: 'user-1', correlationId: 'req-1', now: NOW })

      expect(sessionService.setActiveTenant).toHaveBeenCalledWith('user-1', tenant.id)
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: tenant.id,
          actorUserId: 'user-1',
          action: 'tenant.demo.created',
          resourceType: 'tenant',
          resourceId: tenant.id,
          correlationId: 'req-1',
        }),
      )
    })
  })

  describe('deleteForUser', () => {
    it('throws NotFoundException when the tenant does not exist', async () => {
      tenantRepository.findById.mockResolvedValue(null)

      await expect(
        service.deleteForUser({ userId: 'user-1', tenantId: 'missing', correlationId: 'req-1' }),
      ).rejects.toBeInstanceOf(NotFoundException)
      expect(demoHouseholdRepository.deleteDemoHousehold).not.toHaveBeenCalled()
    })

    it('rejects with TENANT_NOT_DEMO when the tenant is not a demo tenant, even for its owner', async () => {
      tenantRepository.findById.mockResolvedValue(makeTenant({ isDemo: false }))

      await expect(
        service.deleteForUser({ userId: 'user-1', tenantId: 'tenant-1', correlationId: 'req-1' }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'TENANT_NOT_DEMO' }),
      })
      expect(membershipRepository.findByUserAndTenant).not.toHaveBeenCalled()
      expect(demoHouseholdRepository.deleteDemoHousehold).not.toHaveBeenCalled()
    })

    it('throws ForbiddenException when the caller is not a member', async () => {
      tenantRepository.findById.mockResolvedValue(makeTenant())
      membershipRepository.findByUserAndTenant.mockResolvedValue(null)

      await expect(
        service.deleteForUser({ userId: 'user-1', tenantId: 'tenant-1', correlationId: 'req-1' }),
      ).rejects.toBeInstanceOf(ForbiddenException)
      expect(demoHouseholdRepository.deleteDemoHousehold).not.toHaveBeenCalled()
    })

    it('throws ForbiddenException when the caller is a member but not the owner', async () => {
      tenantRepository.findById.mockResolvedValue(makeTenant())
      membershipRepository.findByUserAndTenant.mockResolvedValue({
        id: 'm-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
        role: 'member',
      })

      await expect(
        service.deleteForUser({ userId: 'user-1', tenantId: 'tenant-1', correlationId: 'req-1' }),
      ).rejects.toBeInstanceOf(ForbiddenException)
      expect(demoHouseholdRepository.deleteDemoHousehold).not.toHaveBeenCalled()
    })

    it('deletes the household and clears the active tenant for its owner', async () => {
      tenantRepository.findById.mockResolvedValue(makeTenant())
      membershipRepository.findByUserAndTenant.mockResolvedValue({
        id: 'm-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
        role: 'owner',
      })
      demoHouseholdRepository.deleteDemoHousehold.mockResolvedValue(undefined)
      sessionRepository.clearActiveTenantForUser.mockResolvedValue({ count: 1 })

      await service.deleteForUser({ userId: 'user-1', tenantId: 'tenant-1', correlationId: 'req-1' })

      expect(demoHouseholdRepository.deleteDemoHousehold).toHaveBeenCalledWith('tenant-1')
      expect(sessionRepository.clearActiveTenantForUser).toHaveBeenCalledWith('user-1', 'tenant-1')
    })

    it('does not fail the deletion when clearing the active tenant throws', async () => {
      tenantRepository.findById.mockResolvedValue(makeTenant())
      membershipRepository.findByUserAndTenant.mockResolvedValue({
        id: 'm-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
        role: 'owner',
      })
      demoHouseholdRepository.deleteDemoHousehold.mockResolvedValue(undefined)
      sessionRepository.clearActiveTenantForUser.mockRejectedValue(new Error('session store down'))

      await expect(
        service.deleteForUser({ userId: 'user-1', tenantId: 'tenant-1', correlationId: 'req-1' }),
      ).resolves.toBeUndefined()
    })
  })
})
