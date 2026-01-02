import { NextResponse } from 'next/server'
import { generators } from 'openid-client'
import { getOidcClient } from '../../../../lib/auth/oidc-client'

const STATE_COOKIE = 'plinto_oidc_state'
const VERIFIER_COOKIE = 'plinto_oidc_verifier'

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
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 10, // 10 minutes
  }
  response.cookies.set(STATE_COOKIE, state, cookieOptions)
  response.cookies.set(VERIFIER_COOKIE, codeVerifier, cookieOptions)

  return response
}
