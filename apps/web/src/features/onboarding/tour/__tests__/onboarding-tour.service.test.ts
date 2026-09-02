import { describe, expect, it, vi } from 'vitest'
import { markTourSeen } from '../onboarding-tour.service'
import { apiFetch } from '../../../../lib/api/client'

vi.mock('../../../../lib/api/client', () => ({
  apiFetch: vi.fn(),
}))

describe('markTourSeen', () => {
  it('posts to the onboarding-tour seen endpoint and returns the user', async () => {
    const user = {
      id: 'user-1',
      email: 'alice@example.com',
      createdAt: '2026-01-01T00:00:00.000Z',
      onboardingTourSeenAt: '2026-01-02T00:00:00.000Z',
    }
    vi.mocked(apiFetch).mockResolvedValueOnce({ data: user })

    const result = await markTourSeen()

    expect(apiFetch).toHaveBeenCalledWith('/me/onboarding-tour/seen', { method: 'POST' })
    expect(result).toEqual(user)
  })
})
