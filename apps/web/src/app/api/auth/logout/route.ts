import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL
  const internalKey = process.env.INTERNAL_API_KEY
  const sessionCookie = cookies().get('plinto_session')?.value

  // Always try to revoke the session on the API if we have the necessary info
  if (apiBase && internalKey && sessionCookie) {
    try {
      const apiUrl = apiBase.startsWith('http')
        ? `${apiBase}/auth/logout`
        : `http://localhost:3001${apiBase}/auth/logout`

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
  response.cookies.set('plinto_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  })

  return response
}
