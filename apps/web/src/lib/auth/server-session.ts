import { cookies } from 'next/headers'

const SESSION_COOKIE_NAME = 'plinto_session'

export interface CurrentUser {
  user: { name?: string | null; email?: string } | null
  memberships: unknown[]
  activeTenantId: string | null
}

/**
 * Resolves an absolute base URL for server-side fetches to the API. Server
 * components can't use a relative `/api` path, so a relative configured base is
 * anchored to the local API origin as a development fallback.
 */
export function resolveApiBase(): string {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api'
  return apiBase.startsWith('http') ? apiBase : `http://localhost:3001${apiBase}`
}

export function getServerSessionCookie(): string | undefined {
  return cookies().get(SESSION_COOKIE_NAME)?.value
}

/**
 * Fetches the current user from the API using the session cookie. Returns null
 * when there is no session or it is invalid, so route pages branch on one
 * source of truth instead of each re-implementing the /me round-trip.
 */
export async function fetchCurrentUser(): Promise<CurrentUser | null> {
  const sessionCookie = getServerSessionCookie()
  if (!sessionCookie) {
    return null
  }

  try {
    const response = await fetch(`${resolveApiBase()}/me`, {
      headers: {
        Cookie: `${SESSION_COOKIE_NAME}=${sessionCookie}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      return null
    }

    const body = (await response.json()) as {
      data?: {
        user?: CurrentUser['user']
        memberships?: unknown[]
        activeTenantId?: string | null
      }
    }

    return {
      user: body.data?.user ?? null,
      memberships: body.data?.memberships ?? [],
      activeTenantId: body.data?.activeTenantId ?? null,
    }
  } catch {
    return null
  }
}
