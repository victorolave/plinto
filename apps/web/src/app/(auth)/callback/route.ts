import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getOidcClient } from '../../../lib/auth/oidc-client'
import { createPlintoJwt, JWT_TTL_SECONDS } from '../../../lib/auth/jwt'

const STATE_COOKIE = 'plinto_oidc_state'
const VERIFIER_COOKIE = 'plinto_oidc_verifier'

export async function GET(request: Request) {
  const client = await getOidcClient()
  const params = client.callbackParams(request.url)
  const cookieStore = cookies()
  const storedState = cookieStore.get(STATE_COOKIE)?.value
  const codeVerifier = cookieStore.get(VERIFIER_COOKIE)?.value

  const redirectTo = (path: string) => NextResponse.redirect(new URL(path, request.url))

  if (!storedState || !codeVerifier) {
    return redirectTo('/login')
  }

  const tokenSet = await client.callback(process.env.OIDC_REDIRECT_URI ?? '', params, {
    state: storedState,
    code_verifier: codeVerifier,
  })

  // Store refresh token for session renewal
  const refreshToken = tokenSet.refresh_token

  const claims = tokenSet.claims()
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL
  const internalKey = process.env.INTERNAL_API_KEY

  if (!apiBase || !internalKey) {
    throw new Error('Missing API configuration')
  }

  if (!claims.sub || !claims.email) {
    return redirectTo('/login')
  }

  // Build an absolute session URL when apiBase is configured as a relative path.
  const sessionUrl = apiBase.startsWith('http')
    ? `${apiBase}/auth/session`
    : new URL(`${apiBase}/auth/session`, request.url).toString()

  const sessionResponse = await fetch(sessionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-key': internalKey,
    },
    body: JSON.stringify({
      idpSub: claims.sub,
      email: claims.email,
      name: claims.name,
    }),
  })

  if (!sessionResponse.ok) {
    console.error('[Callback] Session creation failed', sessionResponse.status)
    return redirectTo('/login')
  }

  const sessionPayload = await sessionResponse.json()
  const sessionId = sessionPayload?.data?.sessionId
  const activeTenantId = sessionPayload?.data?.activeTenantId
  const needsOnboarding = sessionPayload?.data?.needsOnboarding
  const user = sessionPayload?.data?.user

  if (!sessionId || !user) {
    console.error('[Callback] Missing sessionId or user in session response')
    return redirectTo('/login')
  }

  // Create internal Plinto JWT token as per ADR 0003
  const jwtToken = createPlintoJwt({
    sub: user.id,
    idp_sub: user.idpSub,
    tenant_id: activeTenantId ?? null,
    session_id: sessionId,
  })

  const response = redirectTo(
    needsOnboarding ? '/onboarding' : activeTenantId ? '/dashboard' : '/select-tenant',
  )
  // Cookie lifetime matches the JWT's absolute ceiling. The backend slides the
  // session's idle expiry on activity, so this is just the hard max age.
  response.cookies.set('plinto_session', jwtToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: JWT_TTL_SECONDS,
  })
  
  // Store refresh token if available
  if (refreshToken) {
    response.cookies.set('plinto_refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })
  }
  
  response.cookies.delete(STATE_COOKIE)
  response.cookies.delete(VERIFIER_COOKIE)
  return response
}
