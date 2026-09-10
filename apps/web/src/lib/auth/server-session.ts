import { cookies } from 'next/headers'
import { resolveApiBase } from '../api/api-base'

const SESSION_COOKIE_NAME = 'plinto_session'

export interface CurrentUser {
  user: { name?: string | null; email?: string } | null
  memberships: unknown[]
  activeTenantId: string | null
}

// Re-exported for backward compatibility: this used to be defined here, and
// other server-side call sites (the logout route, the OIDC callback) import
// it by name. The canonical implementation now lives in lib/api/api-base.ts,
// shared by all three.
export { resolveApiBase }

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
