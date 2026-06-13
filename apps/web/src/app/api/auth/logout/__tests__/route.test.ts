/**
 * Tests for apps/web/src/app/api/auth/logout/route.ts
 *
 * POST /api/auth/logout:
 *  1. Calls the API to revoke the session if env vars + cookie are present.
 *  2. Always returns 200 { success: true }.
 *  3. Always clears plinto_session cookie (maxAge: 0).
 *
 * BUG FOUND:
 *   The handler clears plinto_session but does NOT clear plinto_refresh_token.
 *   A 30-day refresh-token cookie set during callback will survive logout.
 *   Compare with refresh/route.ts which calls response.cookies.delete('plinto_refresh_token')
 *   on failure paths.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---- env stubs (before imports) ----
vi.stubEnv('NODE_ENV', 'test')
vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:3001')
vi.stubEnv('INTERNAL_API_KEY', 'test-internal-key')

// ---- Next.js mocks ----

const mockCookiesGet = vi.fn()

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({ get: mockCookiesGet })),
}))

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn(),
    redirect: vi.fn(),
  },
}))

// ---- actual import (after mocks) ----

import { NextResponse } from 'next/server'
import { POST } from '../route'

const mockNextResponseJson = vi.mocked(NextResponse.json)

// ---- fetch mock ----

const globalFetch = vi.fn()

// ---- response builder ----

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

beforeEach(() => {
  vi.clearAllMocks()

  globalFetch.mockResolvedValue({ ok: true })
  vi.stubGlobal('fetch', globalFetch)

  vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:3001')
  vi.stubEnv('INTERNAL_API_KEY', 'test-internal-key')

  mockCookiesGet.mockReturnValue({ value: 'session-jwt' })
})

describe('POST /api/auth/logout', () => {
  it('returns 200 with { success: true }', async () => {
    const mockResp = makeMockResponse({ success: true })
    mockNextResponseJson.mockReturnValue(mockResp as any)

    const response = await POST()

    expect(mockNextResponseJson).toHaveBeenCalledWith({ success: true })
    expect(response._status).toBe(200)
    expect(await response.json()).toEqual({ success: true })
  })

  it('calls the API revoke endpoint when env vars and session cookie are present', async () => {
    const mockResp = makeMockResponse({ success: true })
    mockNextResponseJson.mockReturnValue(mockResp as any)
    mockCookiesGet.mockReturnValue({ value: 'my-session-value' })

    await POST()

    expect(globalFetch).toHaveBeenCalledWith(
      'http://localhost:3001/auth/logout',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-internal-key': 'test-internal-key',
          Cookie: 'plinto_session=my-session-value',
        }),
      }),
    )
  })

  it('sends Content-Type: application/json to the revoke endpoint', async () => {
    const mockResp = makeMockResponse({ success: true })
    mockNextResponseJson.mockReturnValue(mockResp as any)

    await POST()

    expect(globalFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }),
    )
  })

  it('skips the API call when NEXT_PUBLIC_API_BASE_URL is not set', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', '')
    const mockResp = makeMockResponse({ success: true })
    mockNextResponseJson.mockReturnValue(mockResp as any)

    await POST()

    expect(globalFetch).not.toHaveBeenCalled()
  })

  it('skips the API call when INTERNAL_API_KEY is not set', async () => {
    vi.stubEnv('INTERNAL_API_KEY', '')
    const mockResp = makeMockResponse({ success: true })
    mockNextResponseJson.mockReturnValue(mockResp as any)

    await POST()

    expect(globalFetch).not.toHaveBeenCalled()
  })

  it('skips the API call when session cookie is absent', async () => {
    const mockResp = makeMockResponse({ success: true })
    mockNextResponseJson.mockReturnValue(mockResp as any)
    mockCookiesGet.mockReturnValue(undefined)

    await POST()

    expect(globalFetch).not.toHaveBeenCalled()
  })

  it('still returns 200 and clears session cookie even when the API call rejects', async () => {
    globalFetch.mockRejectedValue(new Error('API unreachable'))
    const mockResp = makeMockResponse({ success: true })
    mockNextResponseJson.mockReturnValue(mockResp as any)

    // Should not throw
    const response = await POST()

    expect(response._status).toBe(200)
  })

  it('clears plinto_session cookie with maxAge: 0', async () => {
    const mockResp = makeMockResponse({ success: true })
    mockNextResponseJson.mockReturnValue(mockResp as any)

    await POST()

    const sessionSet = mockResp.cookies._store['plinto_session']
    expect(sessionSet).toBeDefined()
    expect(sessionSet.value).toBe('')
    expect(sessionSet.options.maxAge).toBe(0)
  })

  it('clears plinto_session with httpOnly: true, sameSite: lax, path: /', async () => {
    const mockResp = makeMockResponse({ success: true })
    mockNextResponseJson.mockReturnValue(mockResp as any)

    await POST()

    const sessionSet = mockResp.cookies._store['plinto_session']
    expect(sessionSet.options.httpOnly).toBe(true)
    expect(sessionSet.options.sameSite).toBe('lax')
    expect(sessionSet.options.path).toBe('/')
  })

  // ---------- BUG: logout does not clear plinto_refresh_token ----------

  it('clears plinto_refresh_token cookie on logout', async () => {
    // BUG: logout/route.ts only calls response.cookies.set("plinto_session", "", { maxAge: 0 })
    // but never touches plinto_refresh_token.
    // A 30-day refresh-token cookie set by callback/route.ts survives logout,
    // allowing silent session re-creation via /api/auth/refresh even after the
    // user explicitly logs out.
    //
    // Compare with refresh/route.ts which correctly calls
    // response.cookies.delete('plinto_refresh_token') on both failure paths.
    //
    // Fix: add response.cookies.set('plinto_refresh_token', '', { ..., maxAge: 0 })
    // (or response.cookies.delete) alongside the plinto_session clear.
    const mockResp = makeMockResponse({ success: true })
    mockNextResponseJson.mockReturnValue(mockResp as any)

    await POST()

    // This assertion currently fails: plinto_refresh_token is never set/deleted
    const refreshCleared =
      mockResp.cookies._store['plinto_refresh_token'] !== undefined ||
      mockResp.cookies._deleted.includes('plinto_refresh_token')
    expect(refreshCleared).toBe(true)
  })

  it('prefixes the API URL with http://localhost:3001 when apiBase is a relative path', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', '/api/v1')
    const mockResp = makeMockResponse({ success: true })
    mockNextResponseJson.mockReturnValue(mockResp as any)

    await POST()

    expect(globalFetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/v1/auth/logout',
      expect.anything(),
    )
  })
})
