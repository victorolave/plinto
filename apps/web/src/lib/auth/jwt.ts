import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production'
const JWT_ISSUER = 'plinto'
const JWT_AUDIENCE = 'plinto-api'

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
    expiresIn: '30m', // Short TTL as per ADR 0003
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

