import { describe, expect, it, vi } from 'vitest'
import { UsersController } from '../users.controller'

describe('UsersController', () => {
  it('returns the profile, memberships, and active tenant for the authenticated user', async () => {
    const userProfileService = {
      getProfile: vi.fn().mockResolvedValue({ id: 'user-1', name: 'Alice' }),
    }
    const membershipRepository = {
      listByUserId: vi.fn().mockResolvedValue([{ id: 'mem-1' }]),
    }
    const sessionService = {
      getActiveTenant: vi.fn().mockResolvedValue('tenant-1'),
      autoSelectIfSingleTenant: vi.fn(),
    }
    const controller = new UsersController(
      userProfileService as any,
      membershipRepository as any,
      sessionService as any,
    )

    const result = await controller.getMe({ user: { id: 'user-1' } } as any)

    expect(userProfileService.getProfile).toHaveBeenCalledWith('user-1')
    expect(membershipRepository.listByUserId).toHaveBeenCalledWith('user-1')
    expect(sessionService.autoSelectIfSingleTenant).not.toHaveBeenCalled()
    expect(result).toEqual({
      data: {
        user: { id: 'user-1', name: 'Alice' },
        memberships: [{ id: 'mem-1' }],
        activeTenantId: 'tenant-1',
      },
    })
  })

  it('auto-selects the active tenant when the user has no active tenant but a single membership', async () => {
    const userProfileService = {
      getProfile: vi.fn().mockResolvedValue({ id: 'user-1', name: 'Alice' }),
    }
    const membershipRepository = {
      listByUserId: vi.fn().mockResolvedValue([{ id: 'mem-1' }]),
    }
    const sessionService = {
      getActiveTenant: vi.fn().mockResolvedValue(null),
      autoSelectIfSingleTenant: vi.fn().mockResolvedValue('tenant-1'),
    }
    const controller = new UsersController(
      userProfileService as any,
      membershipRepository as any,
      sessionService as any,
    )

    const result = await controller.getMe({ user: { id: 'user-1' } } as any)

    expect(sessionService.autoSelectIfSingleTenant).toHaveBeenCalledWith('user-1')
    expect(result.data.activeTenantId).toBe('tenant-1')
  })

  it('updates the profile using the authenticated user and correlation id', async () => {
    const userProfileService = {
      updateProfile: vi.fn().mockResolvedValue({ id: 'user-1', name: 'New Name' }),
    }
    const membershipRepository = { listByUserId: vi.fn() }
    const sessionService = { getActiveTenant: vi.fn(), autoSelectIfSingleTenant: vi.fn() }
    const controller = new UsersController(
      userProfileService as any,
      membershipRepository as any,
      sessionService as any,
    )

    const result = await controller.updateProfile(
      { user: { id: 'user-1' }, requestId: 'corr-1' } as any,
      { name: 'New Name' },
    )

    expect(userProfileService.updateProfile).toHaveBeenCalledWith({
      userId: 'user-1',
      name: 'New Name',
      correlationId: 'corr-1',
    })
    expect(result).toEqual({ data: { id: 'user-1', name: 'New Name' } })
  })

  it('marks the onboarding tour as seen using the authenticated user and correlation id', async () => {
    const userProfileService = {
      markOnboardingTourSeen: vi
        .fn()
        .mockResolvedValue({ id: 'user-1', onboardingTourSeenAt: '2026-01-01T00:00:00.000Z' }),
    }
    const membershipRepository = { listByUserId: vi.fn() }
    const sessionService = { getActiveTenant: vi.fn(), autoSelectIfSingleTenant: vi.fn() }
    const controller = new UsersController(
      userProfileService as any,
      membershipRepository as any,
      sessionService as any,
    )

    const result = await controller.markOnboardingTourSeen({
      user: { id: 'user-1' },
      requestId: 'corr-1',
    } as any)

    expect(userProfileService.markOnboardingTourSeen).toHaveBeenCalledWith({
      userId: 'user-1',
      correlationId: 'corr-1',
    })
    expect(result).toEqual({
      data: { id: 'user-1', onboardingTourSeenAt: '2026-01-01T00:00:00.000Z' },
    })
  })
})
