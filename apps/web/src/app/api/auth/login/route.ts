import { NextResponse } from 'next/server'
import { generators } from 'openid-client'
import { getOidcClient } from '../../../../lib/auth/oidc-client'
import { isSecureCookie } from '../../../../lib/auth/cookie-options'

const STATE_COOKIE = 'plinto_oidc_state'
const VERIFIER_COOKIE = 'plinto_oidc_verifier'

/**
 * MUST stay dynamic. This handler mints a fresh PKCE `code_verifier` and an
 * OAuth `state` per request, and both are only worth anything if they are
 * unpredictable and used once.
 *
 * Nothing in the body below reads a dynamic API — setting cookies on the
 * response does not opt a route out of static generation — so Next classified
 * this route as `○ (Static)` and executed it at build time, baking one
 * build-time state and verifier into the output for every user to share. Login
 * still worked, because the callback compares the cookie against the returned
 * state and they matched, which is exactly why it went unnoticed.
 *
 * `next dev` never prerenders, so this is invisible in development and only
 * appears in a production build.
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  const client = await getOidcClient()
  const codeVerifier = generators.codeVerifier()
  const codeChallenge = generators.codeChallenge(codeVerifier)
  const state = generators.state()

  const authorizationUrl = client.authorizationUrl({
    scope: 'openid email profile',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
  })

  const response = NextResponse.redirect(authorizationUrl)
  // Set cookies with maxAge to ensure they persist during OAuth redirect
  // 10 minutes should be enough for the OAuth flow
  const cookieOptions = {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 10, // 10 minutes
  }
  response.cookies.set(STATE_COOKIE, state, cookieOptions)
  response.cookies.set(VERIFIER_COOKIE, codeVerifier, cookieOptions)

  return response
}
