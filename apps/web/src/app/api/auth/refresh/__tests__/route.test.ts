/**
 * Tests for apps/web/src/app/api/auth/refresh/route.ts
 *
 * POST /api/auth/refresh:
 *  - 401 if plinto_session or plinto_refresh_token cookie absent
 *  - 401 + clears BOTH cookies if JWT is invalid
 *  - 401 + clears BOTH cookies if refreshSession returns null
 *  - 200 + sets new plinto_session cookie on success
 *  - 200 + also sets new plinto_refresh_token when IdP provides one
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---- env stubs (must happen before imports) ----

vi.stubEnv('JWT_SECRET', 'test-secret-refresh')
vi.stubEnv('NODE_ENV', 'test')

// ---- Next.js mocks ----

const mockCookiesGet = vi.fn()

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({ get: mockCookiesGet })),
}))

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn(),
  },
}))

// ---- BFF auth mocks ----
// Paths are relative to THIS __tests__ file, not to the route file.

vi.mock('../../../../../lib/auth/jwt', () => ({
  verifyPlintoJwt: vi.fn(),
}))

vi.mock('../../../../../lib/auth/session-refresh', () => ({
  refreshSession: vi.fn(),
}))

// ---- actual imports (after mocks) ----

import { NextResponse } from 'next/server'
import { verifyPlintoJwt } from '../../../../../lib/auth/jwt'
import { refreshSession } from '../../../../../lib/auth/session-refresh'
import { POST } from '../route'

const mockNextResponseJson = vi.mocked(NextResponse.json)
const mockVerifyJwt = vi.mocked(verifyPlintoJwt)
const mockRefreshSession = vi.mocked(refreshSession)

// ---- response builder helper ----

function makeMockResponse(body: unknown, status = 200) {
  const cookieStore: Record<string, { value: string; options: Record<string, unknown> }> = {}
  const deletedCookies: string[] = []

  return {
    _body: body,
    _status: status,
    cookies: {
      set: vi.fn((name: string, value: string, options: Record<string, unknown> = {}) => {
        cookieStore[name] = { value, options }
      }),
      delete: vi.fn((name: string) => {
        deletedCookies.push(name)
      }),
      _store: cookieStore,
      _deleted: deletedCookies,
    },
    json: () => Promise.resolve(body),
  }
}

const validPayload = {
  sub: 'user-1',
  idp_sub: 'idp|abc',
  tenant_id: 'tenant-1',
  session_id: 'session-xyz',
}

const validRefreshed = {
  jwt: 'new-jwt-token',
  expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  refreshToken: 'new-refresh-token',
}

beforeEach(() => {
  vi.clearAllMocks()

  // Default: both cookies present
  mockCookiesGet.mockImplementation((name: string) => {
    if (name === 'plinto_session') return { value: 'old-session-jwt' }
    if (name === 'plinto_refresh_token') return { value: 'old-refresh-token' }
    return undefined
  })

  mockVerifyJwt.mockReturnValue(validPayload)
  mockRefreshSession.mockResolvedValue(validRefreshed)
})

describe('POST /api/auth/refresh', () => {
  // ---------- missing cookies ----------

  it('returns 401 when plinto_session cookie is missing', async () => {
    mockCookiesGet.mockImplementation((name: string) => {
      if (name === 'plinto_session') return undefined
      if (name === 'plinto_refresh_token') return { value: 'rt' }
      return undefined
    })

    const resp401 = makeMockResponse({ error: 'Session or refresh token missing' }, 401)
    mockNextResponseJson.mockReturnValue(resp401 as any)

    const response = await POST(new Request('http://localhost/api/auth/refresh', { method: 'POST' }))

    expect(response._status).toBe(401)
    expect(await response.json()).toMatchObject({ error: expect.any(String) })
  })

  it('returns 401 when plinto_refresh_token cookie is missing', async () => {
    mockCookiesGet.mockImplementation((name: string) => {
      if (name === 'plinto_session') return { value: 'session-jwt' }
      if (name === 'plinto_refresh_token') return undefined
      return undefined
    })

    const resp401 = makeMockResponse({ error: 'Session or refresh token missing' }, 401)
    mockNextResponseJson.mockReturnValue(resp401 as any)

    const response = await POST(new Request('http://localhost/api/auth/refresh', { method: 'POST' }))

    expect(response._status).toBe(401)
  })

  // ---------- invalid JWT ----------

  it('returns 401 and clears BOTH cookies when verifyPlintoJwt throws', async () => {
    mockVerifyJwt.mockImplementation(() => { throw new Error('invalid token') })
    const resp401 = makeMockResponse({ error: 'Invalid session' }, 401)
    mockNextResponseJson.mockReturnValue(resp401 as any)

    await POST(new Request('http://localhost/api/auth/refresh', { method: 'POST' }))

    expect(resp401.cookies.delete).toHaveBeenCalledWith('plinto_session')
    expect(resp401.cookies.delete).toHaveBeenCalledWith('plinto_refresh_token')
  })

  it('returns 401 status when JWT verification fails', async () => {
    mockVerifyJwt.mockImplementation(() => { throw new Error('expired') })
    const resp401 = makeMockResponse({ error: 'Invalid session' }, 401)
    mockNextResponseJson.mockReturnValue(resp401 as any)

    const response = await POST(new Request('http://localhost/api/auth/refresh', { method: 'POST' }))

    expect(response._status).toBe(401)
  })

  // ---------- refresh failed ----------

  it('returns 401 and clears BOTH cookies when refreshSession returns null', async () => {
    mockRefreshSession.mockResolvedValue(null)
    const resp401 = makeMockResponse({ error: 'Session refresh failed' }, 401)
    mockNextResponseJson.mockReturnValue(resp401 as any)

    await POST(new Request('http://localhost/api/auth/refresh', { method: 'POST' }))

    expect(resp401.cookies.delete).toHaveBeenCalledWith('plinto_session')
    expect(resp401.cookies.delete).toHaveBeenCalledWith('plinto_refresh_token')
  })

  it('returns 401 status when refreshSession returns null', async () => {
    mockRefreshSession.mockResolvedValue(null)
    const resp401 = makeMockResponse({ error: 'Session refresh failed' }, 401)
    mockNextResponseJson.mockReturnValue(resp401 as any)

    const response = await POST(new Request('http://localhost/api/auth/refresh', { method: 'POST' }))

    expect(response._status).toBe(401)
  })

  // ---------- success ----------

  it('returns 200 { success: true } on successful refresh', async () => {
    const resp200 = makeMockResponse({ success: true }, 200)
    mockNextResponseJson.mockReturnValue(resp200 as any)

    const response = await POST(new Request('http://localhost/api/auth/refresh', { method: 'POST' }))

    expect(response._status).toBe(200)
    expect(await response.json()).toEqual({ success: true })
  })

  it('sets new plinto_session cookie with the new JWT on success', async () => {
    const resp200 = makeMockResponse({ success: true }, 200)
    mockNextResponseJson.mockReturnValue(resp200 as any)

    await POST(new Request('http://localhost/api/auth/refresh', { method: 'POST' }))

    const sessionCookie = resp200.cookies._store['plinto_session']
    expect(sessionCookie).toBeDefined()
    expect(sessionCookie.value).toBe('new-jwt-token')
    expect(sessionCookie.options.httpOnly).toBe(true)
    expect(sessionCookie.options.sameSite).toBe('lax')
    expect(sessionCookie.options.path).toBe('/')
  })

  it('sets plinto_session expires to the value from refreshed.expiresAt', async () => {
    const fixedExpiry = new Date(Date.now() + 30 * 60 * 1000)
    mockRefreshSession.mockResolvedValue({ ...validRefreshed, expiresAt: fixedExpiry })
    const resp200 = makeMockResponse({ success: true }, 200)
    mockNextResponseJson.mockReturnValue(resp200 as any)

    await POST(new Request('http://localhost/api/auth/refresh', { method: 'POST' }))

    const sessionCookie = resp200.cookies._store['plinto_session']
    expect(sessionCookie.options.expires).toEqual(fixedExpiry)
  })

  it('sets new plinto_refresh_token cookie when IdP provides a rotated token', async () => {
    const resp200 = makeMockResponse({ success: true }, 200)
    mockNextResponseJson.mockReturnValue(resp200 as any)

    await POST(new Request('http://localhost/api/auth/refresh', { method: 'POST' }))

    const rtCookie = resp200.cookies._store['plinto_refresh_token']
    expect(rtCookie).toBeDefined()
    expect(rtCookie.value).toBe('new-refresh-token')
    expect(rtCookie.options.httpOnly).toBe(true)
    expect(rtCookie.options.maxAge).toBe(60 * 60 * 24 * 30) // 30 days
  })

  it('does NOT set plinto_refresh_token when IdP does not provide a new one', async () => {
    mockRefreshSession.mockResolvedValue({
      jwt: 'new-jwt-token',
      expiresAt: new Date(),
      refreshToken: undefined,
    })
    const resp200 = makeMockResponse({ success: true }, 200)
    mockNextResponseJson.mockReturnValue(resp200 as any)

    await POST(new Request('http://localhost/api/auth/refresh', { method: 'POST' }))

    expect(resp200.cookies._store['plinto_refresh_token']).toBeUndefined()
  })

  // ---------- calls refreshSession with correct args ----------

  it('calls refreshSession with the refresh token and JWT claims', async () => {
    const resp200 = makeMockResponse({ success: true }, 200)
    mockNextResponseJson.mockReturnValue(resp200 as any)

    await POST(new Request('http://localhost/api/auth/refresh', { method: 'POST' }))

    expect(mockRefreshSession).toHaveBeenCalledWith(
      'old-refresh-token',
      validPayload.session_id,
      validPayload.sub,
      validPayload.idp_sub,
      validPayload.tenant_id,
    )
  })

  it('passes null tenant_id to refreshSession when payload.tenant_id is undefined', async () => {
    const payloadNoTenant = { ...validPayload, tenant_id: undefined as unknown as string }
    mockVerifyJwt.mockReturnValue(payloadNoTenant)
    const resp200 = makeMockResponse({ success: true }, 200)
    mockNextResponseJson.mockReturnValue(resp200 as any)

    await POST(new Request('http://localhost/api/auth/refresh', { method: 'POST' }))

    // The route uses `payload.tenant_id ?? null`
    expect(mockRefreshSession).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(String),
      null,
    )
  })
})
