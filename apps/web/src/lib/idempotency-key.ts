/**
 * Generates a client-side idempotency key for one submission intent (see
 * `TransferForm`).
 *
 * `crypto.randomUUID()` only exists in a "secure context" — HTTPS, or
 * `localhost`. This project's own self-hosting guide documents running
 * behind plain HTTP with `COOKIE_SECURE` off, where `window.crypto.randomUUID`
 * is `undefined`, not a function that throws — calling it would crash the
 * whole form on mount for exactly the self-hoster this project is for.
 *
 * Falls back to `crypto.getRandomValues`, which is NOT restricted to secure
 * contexts, to build a v4 UUID by hand. Only as a last resort — an
 * environment with no Web Crypto API at all, which should not happen in any
 * real browser — falls back further to `Math.random()`. That fallback is not
 * cryptographically random, but this key only has to avoid colliding within
 * one browser session; it is not a security token, just a retry-identity the
 * server compares a resubmitted request against.
 */
export function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant 10xx
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0
    const value = char === 'x' ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
}
