/**
 * Tests for apps/web/src/lib/auth/session-refresh.ts
 *
 * refreshSession — calls getOidcClient().refresh(), builds a new JWT,
 *   returns { jwt, expiresAt, refreshToken? } or null on failure.
 *
 * getRefreshTokenFromCookie — parses the Cookie header string.
 *
 * BUG FOUND:
 *   getRefreshTokenFromCookie uses `value.split('=')[1]` which truncates any
 *   token that contains '=' characters (e.g. base64-padded opaque tokens).
 *   A cookie value of 'abc==def' would return 'abc' instead of 'abc==def'.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// We must mock BEFORE importing so the module picks up the mock.
vi.mock('../oidc-client', () => ({
  getOidcClient: vi.fn(),
}))

// Stub JWT_SECRET before the jwt module loads.
vi.stubEnv('JWT_SECRET', 'test-secret-sr')

import { refreshSession, getRefreshTokenFromCookie } from '../session-refresh'
import { getOidcClient } from '../oidc-client'

const mockGetOidcClient = vi.mocked(getOidcClient)

// ---- factory helpers ----

function makeTokenSet(overrides?: { refresh_token?: string }) {
  return {
    refresh_token: 'new-refresh-token',
    ...overrides,
  }
}

function makeOidcClient(tokenSet = makeTokenSet()) {
  return {
    refresh: vi.fn().mockResolvedValue(tokenSet),
  }
}

// ---- refreshSession ----

describe('refreshSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Ensure OIDC env vars are present (oidc-client is mocked so these don't
    // actually reach Issuer.discover, but session-refresh itself doesn't read them)
    vi.stubEnv('OIDC_ISSUER_URL', 'https://idp.example.com')
    vi.stubEnv('OIDC_CLIENT_ID', 'client-id')
    vi.stubEnv('OIDC_CLIENT_SECRET', 'client-secret')
    vi.stubEnv('OIDC_REDIRECT_URI', 'https://app.example.com/callback')
  })

  it('returns a new JWT, expiresAt ~30min from now, and refreshToken on success', async () => {
    const client = makeOidcClient()
    mockGetOidcClient.mockResolvedValue(client as any)

    const before = Date.now()
    const result = await refreshSession('old-refresh', 'session-1', 'user-1', 'idp-sub-1', 'tenant-1')
    const after = Date.now()

    expect(result).not.toBeNull()
    expect(typeof result!.jwt).toBe('string')
    expect(result!.jwt.split('.')).toHaveLength(3) // valid JWT
    expect(result!.refreshToken).toBe('new-refresh-token')

    const expiresMs = result!.expiresAt.getTime()
    expect(expiresMs).toBeGreaterThanOrEqual(before + 30 * 60 * 1000 - 100)
    expect(expiresMs).toBeLessThanOrEqual(after + 30 * 60 * 1000 + 100)
  })

  it('calls client.refresh with the provided refresh token', async () => {
    const client = makeOidcClient()
    mockGetOidcClient.mockResolvedValue(client as any)

    await refreshSession('my-refresh-token', 'session-1', 'user-1', 'idp|sub', null)

    expect(client.refresh).toHaveBeenCalledWith('my-refresh-token')
  })

  it('creates the new internal JWT with correct claims', async () => {
    const client = makeOidcClient()
    mockGetOidcClient.mockResolvedValue(client as any)
    vi.stubEnv('JWT_SECRET', 'test-secret-sr')

    const result = await refreshSession('rt', 'sess-42', 'usr-99', 'idp|xyz', 'tnt-7')

    // Verify the JWT contains the expected sub/session_id by decoding it
    const jwt = await import('jsonwebtoken')
    const payload = jwt.default.decode(result!.jwt) as Record<string, unknown>
    expect(payload.sub).toBe('usr-99')
    expect(payload.idp_sub).toBe('idp|xyz')
    expect(payload.tenant_id).toBe('tnt-7')
    expect(payload.session_id).toBe('sess-42')
  })

  it('passes null tenant_id through to the JWT claims', async () => {
    const client = makeOidcClient()
    mockGetOidcClient.mockResolvedValue(client as any)

    const result = await refreshSession('rt', 'sess-1', 'usr-1', 'idp|sub', null)

    const jwt = await import('jsonwebtoken')
    const payload = jwt.default.decode(result!.jwt) as Record<string, unknown>
    expect(payload.tenant_id).toBeNull()
  })

  it('returns null when tokenSet has no refresh_token (IdP did not rotate)', async () => {
    const client = makeOidcClient(makeTokenSet({ refresh_token: undefined }))
    mockGetOidcClient.mockResolvedValue(client as any)

    const result = await refreshSession('old-rt', 'session-1', 'user-1', 'idp|sub', null)

    expect(result).toBeNull()
  })

  it('returns null (does not throw) when client.refresh rejects', async () => {
    const client = {
      refresh: vi.fn().mockRejectedValue(new Error('IdP offline')),
    }
    mockGetOidcClient.mockResolvedValue(client as any)

    const result = await refreshSession('rt', 'session-1', 'user-1', 'idp|sub', null)

    expect(result).toBeNull()
  })

  it('returns null (does not throw) when getOidcClient rejects', async () => {
    mockGetOidcClient.mockRejectedValue(new Error('OIDC config missing'))

    const result = await refreshSession('rt', 'session-1', 'user-1', 'idp|sub', null)

    expect(result).toBeNull()
  })

  it('includes refreshToken in the result when IdP provides one', async () => {
    const client = makeOidcClient(makeTokenSet({ refresh_token: 'rotated-rt' }))
    mockGetOidcClient.mockResolvedValue(client as any)

    const result = await refreshSession('old-rt', 'session-1', 'user-1', 'idp|sub', null)

    expect(result!.refreshToken).toBe('rotated-rt')
  })
})

// ---- getRefreshTokenFromCookie ----

describe('getRefreshTokenFromCookie', () => {
  it('returns null for a null cookie header', () => {
    expect(getRefreshTokenFromCookie(null)).toBeNull()
  })

  it('returns null when the refresh-token cookie is absent', () => {
    expect(getRefreshTokenFromCookie('session=abc; other=xyz')).toBeNull()
  })

  it('returns the token value from a cookie header with only that cookie', () => {
    expect(getRefreshTokenFromCookie('plinto_refresh_token=mytoken123')).toBe('mytoken123')
  })

  it('returns the token value from a multi-cookie header', () => {
    const header = 'plinto_session=jwt-here; plinto_refresh_token=rt-value; other=x'
    expect(getRefreshTokenFromCookie(header)).toBe('rt-value')
  })

  it('handles cookie header with extra whitespace', () => {
    const header = ' plinto_refresh_token=rt-123 ; plinto_session=s'
    expect(getRefreshTokenFromCookie(header)).toBe('rt-123')
  })

  // ---------- BUG: split('=')[1] truncates tokens with '=' in value ----------

  it('returns full token value when token contains "=" characters (base64 padding)', () => {
    // BUG: getRefreshTokenFromCookie uses `refreshCookie.split('=')[1]`
    // which only captures the segment between the first and second '='.
    // A token like 'abc==def' becomes 'abc' instead of 'abc==def'.
    // Correct implementation should use `refreshCookie.slice(COOKIE_NAME.length + 1)`
    // or `split('=').slice(1).join('=')` to preserve the full value.
    const header = 'plinto_refresh_token=abc==def'
    expect(getRefreshTokenFromCookie(header)).toBe('abc==def')
  })

  it('returns full token value when opaque token ends with padding "=="', () => {
    // BUG: same root cause — `split('=')[1]` truncates anything after the second '='.
    // A base64url opaque token "eyJhbGci==" (shortened for clarity) would lose "=".
    const header = 'plinto_refresh_token=eyJhbGci=='
    expect(getRefreshTokenFromCookie(header)).toBe('eyJhbGci==')
  })
})
