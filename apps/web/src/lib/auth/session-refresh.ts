import { getOidcClient } from './oidc-client'
import { createPlintoJwt } from './jwt'

const REFRESH_TOKEN_COOKIE = 'plinto_refresh_token'

export async function refreshSession(
  refreshToken: string,
  sessionId: string,
  userId: string,
  idpSub: string,
  tenantId: string | null,
): Promise<{ jwt: string; expiresAt: Date; refreshToken?: string } | null> {
  try {
    const client = await getOidcClient()
    
    // Use refresh token to get new tokens from IdP
    const tokenSet = await client.refresh(refreshToken)
    
    if (!tokenSet.refresh_token) {
      // Refresh token expired or invalid
      return null
    }

    // Create new internal JWT
    const jwt = createPlintoJwt({
      sub: userId,
      idp_sub: idpSub,
      tenant_id: tenantId,
      session_id: sessionId,
    })

    // Calculate expiration (30 minutes from now)
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000)

    return {
      jwt,
      expiresAt,
      refreshToken: tokenSet.refresh_token, // New refresh token if IdP provided one
    }
  } catch (error) {
    console.error('[Session Refresh] Failed to refresh session:', error)
    return null
  }
}

export function getRefreshTokenFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null
  const cookies = cookieHeader.split(';').map((c) => c.trim())
  const refreshCookie = cookies.find((c) => c.startsWith(`${REFRESH_TOKEN_COOKIE}=`))
  if (!refreshCookie) return null
  return refreshCookie.split('=')[1]
}

