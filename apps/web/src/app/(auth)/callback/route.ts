import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getOidcClient } from '../../../lib/auth/oidc-client'
import { createPlintoJwt, JWT_TTL_SECONDS } from '../../../lib/auth/jwt'

const STATE_COOKIE = 'plinto_oidc_state'
const VERIFIER_COOKIE = 'plinto_oidc_verifier'

/**
 * MUST stay dynamic: this handler exchanges a single-use authorization code and
 * mints a session, so a prerendered response would be both meaningless and
 * dangerous. Today the route is dynamic only because it reads `cookies()` —
 * an accident of the body rather than a stated requirement. `/api/auth/login`
 * had no such accident and was prerendered into a shared PKCE verifier, so the
 * requirement is written down here instead of left to chance.
 */
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const cookieStore = cookies()
  const redirectTo = (path: string) => NextResponse.redirect(new URL(path, request.url))

  // Every step below (IdP discovery, token exchange, the session call to the
  // API) can throw — most commonly client.callback() when a user replays or
  // refreshes the callback URL and the authorization code has already been
  // consumed. Left unhandled, any of these become a raw Next.js 500. We
  // route all of them through the same recovery as the pre-existing
  // non-throwing failure branches below: log a safe, non-sensitive marker
  // and send the user back to /login.
  let stage = 'oidc_discovery'
  try {
    const client = await getOidcClient()
    const params = client.callbackParams(request.url)
    const storedState = cookieStore.get(STATE_COOKIE)?.value
    const codeVerifier = cookieStore.get(VERIFIER_COOKIE)?.value

    if (!storedState || !codeVerifier) {
      return redirectTo('/login')
    }

    stage = 'token_exchange'
    const tokenSet = await client.callback(process.env.OIDC_REDIRECT_URI ?? '', params, {
      state: storedState,
      code_verifier: codeVerifier,
    })

    // Store refresh token for session renewal
    const refreshToken = tokenSet.refresh_token

    const claims = tokenSet.claims()
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL
    const internalKey = process.env.INTERNAL_API_KEY

    stage = 'config_check'
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

    stage = 'session_fetch'
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

    stage = 'session_parse'
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
  } catch (error) {
    // Never interpolate the raw error/message here: openid-client errors
    // (RPError/OPError) can carry IdP response bodies, and thrown errors
    // from user code could in principle be constructed with request data.
    // `stage` plus the error's constructor name is enough to debug without
    // risking tokens, the authorization code, the code verifier, the
    // internal API key, or cookie values ending up in logs.
    const errorType = error instanceof Error ? error.name : typeof error
    console.error('[Callback] Unhandled failure during OIDC callback', { stage, errorType })

    // The state/verifier cookies are single-use and scoped to this specific
    // authorization attempt. Once the attempt has failed there is no
    // recovery that reuses them (this is most visible on a replayed code:
    // client.callback() throws and the cookies from that consumed attempt
    // are now dead weight), so we clear them here rather than leave them
    // sitting in the browser until they expire on their own.
    const response = redirectTo('/login')
    response.cookies.delete(STATE_COOKIE)
    response.cookies.delete(VERIFIER_COOKIE)
    return response
  }
}
