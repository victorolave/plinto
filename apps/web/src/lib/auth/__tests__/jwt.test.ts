/**
 * Tests for apps/web/src/lib/auth/jwt.ts
 *
 * jwt.ts reads JWT_SECRET at module load time so we must set the env var
 * before importing. We use dynamic import() inside each describe block to
 * isolate the module from different secrets.
 *
 * We use the REAL jsonwebtoken library (no mock) to validate the full
 * sign → verify roundtrip.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest'
import jwt from 'jsonwebtoken'

// The module is loaded fresh for each isolated test group via vi.resetModules()
// followed by a dynamic import().

const TEST_SECRET = 'test-secret-for-vitest'

// Helper to get a fresh module instance with a given secret
async function loadJwtModule(secret: string) {
  vi.resetModules()
  vi.stubEnv('JWT_SECRET', secret)
  const mod = await import('../jwt')
  return mod
}

describe('jwt.ts — createPlintoJwt / verifyPlintoJwt', () => {
  let createPlintoJwt: Awaited<ReturnType<typeof loadJwtModule>>['createPlintoJwt']
  let verifyPlintoJwt: Awaited<ReturnType<typeof loadJwtModule>>['verifyPlintoJwt']

  beforeAll(async () => {
    const mod = await loadJwtModule(TEST_SECRET)
    createPlintoJwt = mod.createPlintoJwt
    verifyPlintoJwt = mod.verifyPlintoJwt
  })

  const baseClaims = {
    sub: 'user-1',
    idp_sub: 'google|abc',
    tenant_id: 'tenant-1',
    session_id: 'session-xyz',
  }

  // ---------- roundtrip ----------

  it('roundtrip: verifyPlintoJwt returns the same claims that were signed', () => {
    const token = createPlintoJwt(baseClaims)
    const decoded = verifyPlintoJwt(token)

    expect(decoded.sub).toBe(baseClaims.sub)
    expect(decoded.idp_sub).toBe(baseClaims.idp_sub)
    expect(decoded.tenant_id).toBe(baseClaims.tenant_id)
    expect(decoded.session_id).toBe(baseClaims.session_id)
  })

  it('roundtrip: null tenant_id is preserved', () => {
    const token = createPlintoJwt({ ...baseClaims, tenant_id: null })
    const decoded = verifyPlintoJwt(token)
    expect(decoded.tenant_id).toBeNull()
  })

  it('roundtrip: undefined tenant_id is preserved (optional field)', () => {
    const { tenant_id: _omit, ...claimsWithoutTenant } = baseClaims
    const token = createPlintoJwt(claimsWithoutTenant)
    const decoded = verifyPlintoJwt(token)
    expect(decoded.tenant_id).toBeUndefined()
  })

  // ---------- token structure ----------

  it('produced token is a valid JWT string (three dot-separated parts)', () => {
    const token = createPlintoJwt(baseClaims)
    expect(token.split('.')).toHaveLength(3)
  })

  it('token carries iss=plinto and aud=plinto-api', () => {
    const token = createPlintoJwt(baseClaims)
    // Decode without verification to inspect headers/payload
    const raw = jwt.decode(token) as Record<string, unknown>
    expect(raw.iss).toBe('plinto')
    expect(raw.aud).toBe('plinto-api')
  })

  it('token carries an exp claim at the 8h absolute ceiling', () => {
    const before = Math.floor(Date.now() / 1000)
    const token = createPlintoJwt(baseClaims)
    const raw = jwt.decode(token) as Record<string, unknown>
    const exp = raw.exp as number
    // 8 hours = 28800 seconds (sliding session handles idle; this is the cap)
    expect(exp).toBeGreaterThan(before + 28800 - 100)
    expect(exp).toBeLessThan(before + 28800 + 100)
  })

  // ---------- tampered token ----------

  it('throws when the token payload is tampered', () => {
    const token = createPlintoJwt(baseClaims)
    // Flip one character in the payload segment
    const parts = token.split('.')
    parts[1] = parts[1].slice(0, -1) + (parts[1].endsWith('A') ? 'B' : 'A')
    const tampered = parts.join('.')
    expect(() => verifyPlintoJwt(tampered)).toThrow()
  })

  it('throws when the signature is corrupted', () => {
    const token = createPlintoJwt(baseClaims)
    const parts = token.split('.')
    parts[2] = parts[2].slice(0, -1) + (parts[2].endsWith('X') ? 'Y' : 'X')
    const tampered = parts.join('.')
    expect(() => verifyPlintoJwt(tampered)).toThrow()
  })

  // ---------- wrong secret ----------

  it('throws when verified with a different secret', async () => {
    // Sign with one secret, verify with another
    const mod1 = await loadJwtModule('secret-one')
    const token = mod1.createPlintoJwt(baseClaims)

    const mod2 = await loadJwtModule('secret-two')
    expect(() => mod2.verifyPlintoJwt(token)).toThrow()
  })

  // ---------- wrong issuer / audience ----------

  it('throws when token issuer does not match', () => {
    // Manually forge a token with a different issuer using the same secret.
    // We must NOT pass audience in options when the payload already has 'aud'.
    const forged = jwt.sign(
      { ...baseClaims, iss: 'evil-issuer', aud: 'plinto-api' },
      TEST_SECRET,
    )
    expect(() => verifyPlintoJwt(forged)).toThrow()
  })

  it('throws when token audience does not match', () => {
    const forged = jwt.sign(
      { ...baseClaims },
      TEST_SECRET,
      { issuer: 'plinto', audience: 'wrong-audience' },
    )
    expect(() => verifyPlintoJwt(forged)).toThrow()
  })

  // ---------- expiry ----------

  it('throws for an already-expired token (exp in the past)', () => {
    // Sign a token that expired 10 seconds ago
    const expired = jwt.sign(
      { ...baseClaims },
      TEST_SECRET,
      {
        issuer: 'plinto',
        audience: 'plinto-api',
        expiresIn: -10, // negative = already expired
      },
    )
    expect(() => verifyPlintoJwt(expired)).toThrow(/expired/)
  })

  it('throws for an expired token using fake timers', () => {
    vi.useFakeTimers()
    try {
      const token = createPlintoJwt(baseClaims)
      // Advance past the 8h TTL
      vi.advanceTimersByTime(8 * 60 * 60 * 1000 + 60 * 1000)
      expect(() => verifyPlintoJwt(token)).toThrow()
    } finally {
      vi.useRealTimers()
    }
  })
})
