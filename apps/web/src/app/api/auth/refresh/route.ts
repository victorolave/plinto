import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyPlintoJwt, PlintoJwtPayload } from '../../../lib/auth/jwt'
import { refreshSession } from '../../../lib/auth/session-refresh'

export async function POST(request: Request) {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get('plinto_session')?.value
  const refreshTokenCookie = cookieStore.get('plinto_refresh_token')?.value

  if (!sessionCookie || !refreshTokenCookie) {
    return NextResponse.json({ error: 'Session or refresh token missing' }, { status: 401 })
  }

  try {
    // Decode current JWT to get session info
    const payload = verifyPlintoJwt(sessionCookie) as PlintoJwtPayload

    // Refresh session
    const refreshed = await refreshSession(
      refreshTokenCookie,
      payload.session_id,
      payload.sub,
      payload.idp_sub,
      payload.tenant_id ?? null,
    )

    if (!refreshed) {
      // Refresh failed, force logout
      const response = NextResponse.json({ error: 'Session refresh failed' }, { status: 401 })
      response.cookies.delete('plinto_session')
      response.cookies.delete('plinto_refresh_token')
      return response
    }

    // Set new session cookie
    const response = NextResponse.json({ success: true })
    response.cookies.set('plinto_session', refreshed.jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: refreshed.expiresAt,
    })

    // Update refresh token if IdP provided a new one
    if (refreshed.refreshToken) {
      response.cookies.set('plinto_refresh_token', refreshed.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      })
    }

    return response
  } catch (error) {
    // Invalid JWT or other error
    const response = NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    response.cookies.delete('plinto_session')
    response.cookies.delete('plinto_refresh_token')
    return response
  }
}

