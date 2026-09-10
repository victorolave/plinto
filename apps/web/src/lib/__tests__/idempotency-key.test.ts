import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateIdempotencyKey } from '../idempotency-key'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

describe('generateIdempotencyKey', () => {
  const originalCrypto = globalThis.crypto

  afterEach(() => {
    Object.defineProperty(globalThis, 'crypto', {
      value: originalCrypto,
      configurable: true,
      writable: true,
    })
  })

  it('uses crypto.randomUUID when available', () => {
    const randomUUID = vi.fn(() => '11111111-1111-4111-8111-111111111111')
    Object.defineProperty(globalThis, 'crypto', {
      value: { randomUUID },
      configurable: true,
      writable: true,
    })

    expect(generateIdempotencyKey()).toBe('11111111-1111-4111-8111-111111111111')
    expect(randomUUID).toHaveBeenCalledTimes(1)
  })

  /**
   * `crypto.randomUUID` is restricted to secure contexts (HTTPS, or
   * localhost). This project documents self-hosting over plain HTTP with
   * `COOKIE_SECURE` off — an environment where `randomUUID` is `undefined`
   * but `getRandomValues` still works, since only the former is restricted.
   */
  it('falls back to crypto.getRandomValues when randomUUID is unavailable (insecure context)', () => {
    const getRandomValues = vi.fn((array: Uint8Array) => {
      array.set(Array.from({ length: array.length }, (_, i) => i))
      return array
    })
    Object.defineProperty(globalThis, 'crypto', {
      value: { getRandomValues },
      configurable: true,
      writable: true,
    })

    const key = generateIdempotencyKey()

    expect(getRandomValues).toHaveBeenCalledTimes(1)
    expect(key).toMatch(UUID_PATTERN)
  })

  it('falls back to Math.random when no Web Crypto API exists at all', () => {
    Object.defineProperty(globalThis, 'crypto', {
      value: undefined,
      configurable: true,
      writable: true,
    })

    const key = generateIdempotencyKey()

    expect(key).toMatch(UUID_PATTERN)
  })

  it('never crashes and always returns a usable string across repeated calls', () => {
    Object.defineProperty(globalThis, 'crypto', {
      value: undefined,
      configurable: true,
      writable: true,
    })

    const keys = Array.from({ length: 20 }, () => generateIdempotencyKey())

    for (const key of keys) {
      expect(key).toMatch(UUID_PATTERN)
    }
    // Not a strict uniqueness proof (Math.random can theoretically repeat),
    // but 20 draws colliding would indicate something is badly wrong.
    expect(new Set(keys).size).toBe(keys.length)
  })
})
