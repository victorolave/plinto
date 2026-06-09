/**
 * Tests for apps/web/src/lib/auth/session.ts
 *
 * getSessionCookie() — reads 'plinto_session' via next/headers cookies()
 * requireSession()   — returns { token } or null
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock next/headers before the module loads.
const mockGet = vi.fn()
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({ get: mockGet })),
}))

import { getSessionCookie, requireSession } from '../session'

describe('getSessionCookie', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the session token string when the cookie is present', () => {
    mockGet.mockReturnValue({ value: 'jwt-token-abc' })

    const result = getSessionCookie()

    expect(result).toBe('jwt-token-abc')
    expect(mockGet).toHaveBeenCalledWith('plinto_session')
  })

  it('returns undefined when the cookie is absent', () => {
    mockGet.mockReturnValue(undefined)

    const result = getSessionCookie()

    expect(result).toBeUndefined()
  })
})

describe('requireSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns { token } when the session cookie is present', () => {
    mockGet.mockReturnValue({ value: 'my-session-jwt' })

    const result = requireSession()

    expect(result).toEqual({ token: 'my-session-jwt' })
  })

  it('returns null when the session cookie is absent', () => {
    mockGet.mockReturnValue(undefined)

    const result = requireSession()

    expect(result).toBeNull()
  })

  it('returns null when the session cookie value is an empty string', () => {
    mockGet.mockReturnValue({ value: '' })

    // An empty string is falsy, requireSession should return null
    const result = requireSession()

    // requireSession checks `if (!session)` — empty string is falsy → null
    expect(result).toBeNull()
  })
})
