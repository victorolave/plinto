import { describe, expect, it, vi, beforeEach } from 'vitest'
import { isSecureCookie } from '../cookie-options'

describe('isSecureCookie', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns true when COOKIE_SECURE is "true", regardless of NODE_ENV', () => {
    vi.stubEnv('COOKIE_SECURE', 'true')
    vi.stubEnv('NODE_ENV', 'development')

    expect(isSecureCookie()).toBe(true)
  })

  it('returns false when COOKIE_SECURE is "false", regardless of NODE_ENV', () => {
    vi.stubEnv('COOKIE_SECURE', 'false')
    vi.stubEnv('NODE_ENV', 'production')

    expect(isSecureCookie()).toBe(false)
  })

  it('falls back to NODE_ENV === "production" when COOKIE_SECURE is unset', () => {
    delete process.env.COOKIE_SECURE
    vi.stubEnv('NODE_ENV', 'production')
    expect(isSecureCookie()).toBe(true)

    vi.stubEnv('NODE_ENV', 'development')
    expect(isSecureCookie()).toBe(false)
  })

  it('throws a clear error for any other COOKIE_SECURE value', () => {
    vi.stubEnv('COOKIE_SECURE', 'yes')

    expect(() => isSecureCookie()).toThrow(/Invalid COOKIE_SECURE value "yes"/)
  })
})
