import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { resolveApiBase } from '../../../../lib/auth/server-session'
import { isSecureCookie } from '../../../../lib/auth/cookie-options'

export async function POST() {
  const apiBaseConfigured = process.env.NEXT_PUBLIC_API_BASE_URL
  const internalKey = process.env.INTERNAL_API_KEY
  const sessionCookie = cookies().get('plinto_session')?.value

  // Always try to revoke the session on the API if we have the necessary info
  if (apiBaseConfigured && internalKey && sessionCookie) {
    try {
      const apiUrl = `${resolveApiBase()}/auth/logout`

      await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-key': internalKey,
          Cookie: `plinto_session=${sessionCookie}`,
        },
      })
    } catch (error) {
      // Log error but continue to clear the cookie anyway
      console.error('[Logout] Failed to revoke session on API:', error)
    }
  }

  // Always clear the session cookie, even if API call failed
  // This ensures the user is logged out from the web app perspective
  const response = NextResponse.json({ success: true })
  const clearedCookie = {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: 'lax' as const,
    maxAge: 0,
    path: '/',
  }
  response.cookies.set('plinto_session', '', clearedCookie)
  // Also clear the long-lived IdP refresh token cookie — it's a credential and
  // must not outlive the session.
  response.cookies.set('plinto_refresh_token', '', clearedCookie)

  return response
}
