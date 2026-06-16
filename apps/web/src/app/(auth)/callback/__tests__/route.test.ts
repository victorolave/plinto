/**
 * Tests for apps/web/src/app/(auth)/callback/route.ts
 *
 * GET /callback?code=...&state=...:
 *  1. Redirects to /login when state or verifier cookie is missing.
 *  2. Redirects to /login when claims.sub or claims.email are missing.
 *  3. Redirects to /login when the session API returns a non-ok status.
 *  4. Redirects to /login when sessionId or user is missing from API response.
 *  5. Throws when API env vars are missing.
 *  6. On success: sets plinto_session and plinto_refresh_token, deletes OIDC
 *     state/verifier cookies, and redirects to the correct path.
 *  7. Redirect target logic: /onboarding, /, /select-tenant.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---- env stubs (before imports) ----
vi.stubEnv('JWT_SECRET', 'test-secret-cb')
vi.stubEnv('NODE_ENV', 'test')
vi.stubEnv('OIDC_REDIRECT_URI', 'https://app.example.com/callback')
vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:3001')
vi.stubEnv('INTERNAL_API_KEY', 'test-internal-key')

// ---- Next.js mocks ----

const mockCookiesGet = vi.fn()

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({ get: mockCookiesGet })),
}))

vi.mock('next/server', () => ({
  NextResponse: {
    redirect: vi.fn(),
    json: vi.fn(),
  },
}))

// ---- BFF auth mocks ----
// Use the path as seen from THIS test file

vi.mock('../../../../lib/auth/oidc-client', () => ({
  getOidcClient: vi.fn(),
}))

vi.mock('../../../../lib/auth/jwt', () => ({
  createPlintoJwt: vi.fn().mockReturnValue('mocked-jwt-token'),
}))

// ---- actual imports (after mocks) ----

import { NextResponse } from 'next/server'
import { getOidcClient } from '../../../../lib/auth/oidc-client'
import { createPlintoJwt } from '../../../../lib/auth/jwt'
import { GET } from '../route'

const mockNextResponseRedirect = vi.mocked(NextResponse.redirect)
const mockGetOidcClient = vi.mocked(getOidcClient)
const mockCreatePlintoJwt = vi.mocked(createPlintoJwt)

// ---- fetch mock ----
const globalFetch = vi.fn()

// ---- helpers ----

type MockRedirectResponse = {
  _redirectUrl: string
  _status: number
  cookies: {
    set: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
    _store: Record<string, { value: string; options: Record<string, unknown> }>
    _deleted: string[]
  }
}

function makeMockRedirectResponse(pathname: string): MockRedirectResponse {
  const cookieStore: Record<string, { value: string; options: Record<string, unknown> }> = {}
  const deletedCookies: string[] = []

  return {
    _redirectUrl: pathname,
    _status: 302,
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
  }
}

function makeOidcClient(overrides?: {
  callbackParams?: ReturnType<typeof vi.fn>
  callback?: ReturnType<typeof vi.fn>
}) {
  return {
    callbackParams: overrides?.callbackParams ??
      vi.fn().mockReturnValue({ code: 'authcode', state: 'abc-state' }),
    callback: overrides?.callback ?? vi.fn().mockResolvedValue({
      refresh_token: 'oidc-refresh-token',
      claims: () => ({
        sub: 'idp|user-sub',
        email: 'user@example.com',
        name: 'Test User',
      }),
    }),
  }
}

const defaultSessionApiResponse = {
  ok: true,
  json: () =>
    Promise.resolve({
      data: {
        sessionId: 'session-123',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        activeTenantId: 'tenant-1',
        needsOnboarding: false,
        user: {
          id: 'user-1',
          idpSub: 'idp|user-sub',
        },
      },
    }),
}

const BASE_URL = 'http://localhost:3000'
const CALLBACK_URL = `${BASE_URL}/callback?code=authcode&state=abc-state`

function makeRequest(url = CALLBACK_URL) {
  return new Request(url)
}

beforeEach(() => {
  vi.clearAllMocks()

  vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:3001')
  vi.stubEnv('INTERNAL_API_KEY', 'test-internal-key')
  vi.stubEnv('OIDC_REDIRECT_URI', 'https://app.example.com/callback')

  // Default: both OIDC cookies present
  mockCookiesGet.mockImplementation((name: string) => {
    if (name === 'plinto_oidc_state') return { value: 'abc-state' }
    if (name === 'plinto_oidc_verifier') return { value: 'pkce-verifier' }
    return undefined
  })

  mockGetOidcClient.mockResolvedValue(makeOidcClient() as any)
  mockCreatePlintoJwt.mockReturnValue('mocked-jwt-token')

  globalFetch.mockResolvedValue(defaultSessionApiResponse)
  vi.stubGlobal('fetch', globalFetch)

  // Default redirect: capture the pathname from the URL passed to NextResponse.redirect
  mockNextResponseRedirect.mockImplementation((url: URL) => {
    return makeMockRedirectResponse(url.pathname) as any
  })
})

// ---- tests ----

describe('GET /callback', () => {

  // ---------- missing OIDC cookies ----------

  it('redirects to /login when plinto_oidc_state cookie is missing', async () => {
    mockCookiesGet.mockImplementation((name: string) => {
      if (name === 'plinto_oidc_verifier') return { value: 'verifier' }
      return undefined
    })

    const response = await GET(makeRequest()) as unknown as MockRedirectResponse

    expect(response._redirectUrl).toBe('/login')
  })

  it('redirects to /login when plinto_oidc_verifier cookie is missing', async () => {
    mockCookiesGet.mockImplementation((name: string) => {
      if (name === 'plinto_oidc_state') return { value: 'state' }
      return undefined
    })

    const response = await GET(makeRequest()) as unknown as MockRedirectResponse

    expect(response._redirectUrl).toBe('/login')
  })

  // ---------- missing claims ----------

  it('redirects to /login when claims.sub is missing', async () => {
    mockGetOidcClient.mockResolvedValue(makeOidcClient({
      callback: vi.fn().mockResolvedValue({
        refresh_token: 'rt',
        claims: () => ({ sub: null, email: 'u@e.com' }),
      }),
    }) as any)

    const response = await GET(makeRequest()) as unknown as MockRedirectResponse

    expect(response._redirectUrl).toBe('/login')
  })

  it('redirects to /login when claims.email is missing', async () => {
    mockGetOidcClient.mockResolvedValue(makeOidcClient({
      callback: vi.fn().mockResolvedValue({
        refresh_token: 'rt',
        claims: () => ({ sub: 'idp|sub', email: null }),
      }),
    }) as any)

    const response = await GET(makeRequest()) as unknown as MockRedirectResponse

    expect(response._redirectUrl).toBe('/login')
  })

  // ---------- API errors ----------

  it('throws when NEXT_PUBLIC_API_BASE_URL is not set', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', '')
    vi.stubEnv('INTERNAL_API_KEY', 'key')

    await expect(GET(makeRequest())).rejects.toThrow('Missing API configuration')
  })

  it('throws when INTERNAL_API_KEY is not set', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:3001')
    vi.stubEnv('INTERNAL_API_KEY', '')

    await expect(GET(makeRequest())).rejects.toThrow('Missing API configuration')
  })

  it('redirects to /login when session API returns non-ok', async () => {
    globalFetch.mockResolvedValue({ ok: false, status: 500 })

    const response = await GET(makeRequest()) as unknown as MockRedirectResponse

    expect(response._redirectUrl).toBe('/login')
  })

  it('redirects to /login when sessionId is missing from session response', async () => {
    globalFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { user: { id: 'u-1' }, sessionId: null } }),
    })

    const response = await GET(makeRequest()) as unknown as MockRedirectResponse

    expect(response._redirectUrl).toBe('/login')
  })

  it('redirects to /login when user is missing from session response', async () => {
    globalFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { sessionId: 'sess-1', user: null } }),
    })

    const response = await GET(makeRequest()) as unknown as MockRedirectResponse

    expect(response._redirectUrl).toBe('/login')
  })

  // ---------- session API call ----------

  it('POSTs to the correct session endpoint with idpSub, email, and name', async () => {
    const redirectResp = makeMockRedirectResponse('/')
    mockNextResponseRedirect.mockReturnValue(redirectResp as any)

    await GET(makeRequest())

    expect(globalFetch).toHaveBeenCalledWith(
      'http://localhost:3001/auth/session',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'x-internal-key': 'test-internal-key',
        }),
        body: expect.stringContaining('"idpSub"'),
      }),
    )

    const body = JSON.parse(globalFetch.mock.calls[0][1].body)
    expect(body.idpSub).toBe('idp|user-sub')
    expect(body.email).toBe('user@example.com')
    expect(body.name).toBe('Test User')
  })

  it('builds absolute session URL when apiBase is a relative path', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', '/api/v1')
    const redirectResp = makeMockRedirectResponse('/')
    mockNextResponseRedirect.mockReturnValue(redirectResp as any)

    await GET(makeRequest())

    const calledUrl = globalFetch.mock.calls[0][0]
    expect(calledUrl).toMatch(/\/api\/v1\/auth\/session$/)
    expect(calledUrl).toMatch(/^http/)
  })

  // ---------- createPlintoJwt ----------

  it('calls createPlintoJwt with the session claims from the API response', async () => {
    const redirectResp = makeMockRedirectResponse('/')
    mockNextResponseRedirect.mockReturnValue(redirectResp as any)

    await GET(makeRequest())

    expect(mockCreatePlintoJwt).toHaveBeenCalledWith({
      sub: 'user-1',
      idp_sub: 'idp|user-sub',
      tenant_id: 'tenant-1',
      session_id: 'session-123',
    })
  })

  it('passes null as tenant_id when activeTenantId is absent from API response', async () => {
    globalFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            sessionId: 'sess-1',
            user: { id: 'u-1', idpSub: 'idp|sub' },
            activeTenantId: undefined,
            needsOnboarding: true,
          },
        }),
    })
    const redirectResp = makeMockRedirectResponse('/onboarding')
    mockNextResponseRedirect.mockReturnValue(redirectResp as any)

    await GET(makeRequest())

    expect(mockCreatePlintoJwt).toHaveBeenCalledWith(
      expect.objectContaining({ tenant_id: null }),
    )
  })

  // ---------- cookie handling ----------

  it('sets plinto_session cookie with the JWT token', async () => {
    const redirectResp = makeMockRedirectResponse('/')
    mockNextResponseRedirect.mockReturnValue(redirectResp as any)

    await GET(makeRequest())

    const sessionCookie = redirectResp.cookies._store['plinto_session']
    expect(sessionCookie).toBeDefined()
    expect(sessionCookie.value).toBe('mocked-jwt-token')
    expect(sessionCookie.options.httpOnly).toBe(true)
    expect(sessionCookie.options.sameSite).toBe('lax')
    expect(sessionCookie.options.path).toBe('/')
  })

  it('sets plinto_refresh_token cookie when OIDC provides a refresh token', async () => {
    const redirectResp = makeMockRedirectResponse('/')
    mockNextResponseRedirect.mockReturnValue(redirectResp as any)

    await GET(makeRequest())

    const rtCookie = redirectResp.cookies._store['plinto_refresh_token']
    expect(rtCookie).toBeDefined()
    expect(rtCookie.value).toBe('oidc-refresh-token')
    expect(rtCookie.options.httpOnly).toBe(true)
    expect(rtCookie.options.maxAge).toBe(60 * 60 * 24 * 30) // 30 days
    expect(rtCookie.options.path).toBe('/')
  })

  it('does NOT set plinto_refresh_token when tokenSet has no refresh_token', async () => {
    mockGetOidcClient.mockResolvedValue(makeOidcClient({
      callback: vi.fn().mockResolvedValue({
        refresh_token: undefined,
        claims: () => ({ sub: 'idp|sub', email: 'u@e.com', name: 'U' }),
      }),
    }) as any)
    const redirectResp = makeMockRedirectResponse('/')
    mockNextResponseRedirect.mockReturnValue(redirectResp as any)

    await GET(makeRequest())

    expect(redirectResp.cookies._store['plinto_refresh_token']).toBeUndefined()
  })

  it('deletes plinto_oidc_state cookie on success', async () => {
    const redirectResp = makeMockRedirectResponse('/')
    mockNextResponseRedirect.mockReturnValue(redirectResp as any)

    await GET(makeRequest())

    expect(redirectResp.cookies.delete).toHaveBeenCalledWith('plinto_oidc_state')
  })

  it('deletes plinto_oidc_verifier cookie on success', async () => {
    const redirectResp = makeMockRedirectResponse('/')
    mockNextResponseRedirect.mockReturnValue(redirectResp as any)

    await GET(makeRequest())

    expect(redirectResp.cookies.delete).toHaveBeenCalledWith('plinto_oidc_verifier')
  })

  // ---------- redirect target logic ----------

  it('redirects to /onboarding when needsOnboarding is true', async () => {
    globalFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            sessionId: 'sess-1',
            user: { id: 'u-1', idpSub: 'idp|sub' },
            activeTenantId: 'tenant-1',
            needsOnboarding: true,
          },
        }),
    })
    const redirectResp = makeMockRedirectResponse('/onboarding')
    mockNextResponseRedirect.mockReturnValue(redirectResp as any)

    const response = await GET(makeRequest()) as unknown as MockRedirectResponse

    expect(response._redirectUrl).toBe('/onboarding')
  })

  it('redirects to /dashboard when user has an active tenant and no onboarding needed', async () => {
    const redirectResp = makeMockRedirectResponse('/dashboard')
    mockNextResponseRedirect.mockReturnValue(redirectResp as any)

    const response = await GET(makeRequest()) as unknown as MockRedirectResponse

    expect(response._redirectUrl).toBe('/dashboard')
  })

  it('redirects to /select-tenant when activeTenantId is null and no onboarding needed', async () => {
    globalFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            sessionId: 'sess-1',
            user: { id: 'u-1', idpSub: 'idp|sub' },
            activeTenantId: null,
            needsOnboarding: false,
          },
        }),
    })
    const redirectResp = makeMockRedirectResponse('/select-tenant')
    mockNextResponseRedirect.mockReturnValue(redirectResp as any)

    const response = await GET(makeRequest()) as unknown as MockRedirectResponse

    expect(response._redirectUrl).toBe('/select-tenant')
  })

  // ---------- oidc-client invocations ----------

  it('calls client.callback with storedState, codeVerifier, and OIDC_REDIRECT_URI', async () => {
    const mockCallback = vi.fn().mockResolvedValue({
      refresh_token: 'rt',
      claims: () => ({ sub: 'idp|sub', email: 'u@e.com', name: 'U' }),
    })
    mockGetOidcClient.mockResolvedValue(makeOidcClient({ callback: mockCallback }) as any)
    const redirectResp = makeMockRedirectResponse('/')
    mockNextResponseRedirect.mockReturnValue(redirectResp as any)

    await GET(makeRequest())

    expect(mockCallback).toHaveBeenCalledWith(
      'https://app.example.com/callback',
      expect.anything(),
      expect.objectContaining({
        state: 'abc-state',
        code_verifier: 'pkce-verifier',
      }),
    )
  })
})
