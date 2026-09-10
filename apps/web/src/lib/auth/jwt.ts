import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production'
const JWT_ISSUER = 'plinto'
const JWT_AUDIENCE = 'plinto-api'

/**
 * Absolute session lifetime (max age of a single JWT and its cookie).
 * Revocation stays immediate regardless of this value: the API's AuthGuard
 * validates the DB session on every request and slides its idle expiry, so a
 * longer JWT does not weaken security here. Active users are kept logged in by
 * the sliding session; this is only the hard ceiling before a re-login.
 */
export const JWT_TTL_SECONDS = 60 * 60 * 8 // 8 hours

export interface PlintoJwtPayload {
  sub: string // Internal user ID
  idp_sub: string // IdP subject
  tenant_id?: string | null // Optional tenant ID
  session_id: string // Session ID for revocation
}

export function createPlintoJwt(payload: PlintoJwtPayload): string {
  const token = jwt.sign(payload, JWT_SECRET, {
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    expiresIn: JWT_TTL_SECONDS, // absolute ceiling; sliding session handles idle
  })
  return token
}

export function verifyPlintoJwt(token: string): PlintoJwtPayload {
  const decoded = jwt.verify(token, JWT_SECRET, {
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  }) as PlintoJwtPayload
  return decoded
}

