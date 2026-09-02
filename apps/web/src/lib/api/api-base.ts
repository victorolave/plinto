/**
 * Resolves the API base URL for server-side requests made from within this
 * Next.js app — server components, route handlers — as opposed to the
 * browser, which always talks to `NEXT_PUBLIC_API_BASE_URL` (see
 * `lib/api/client.ts`; that one must stay browser-safe and never read
 * `API_INTERNAL_URL`, which is server-only).
 *
 * `API_INTERNAL_URL` lets a container reach the API over an address that
 * differs from the public one the browser uses — e.g. a private network
 * hostname or a Docker service name — and takes priority over
 * `NEXT_PUBLIC_API_BASE_URL` for these server-side calls. Both fall back to
 * the local dev default, and a relative value is anchored to it, exactly as
 * the pre-existing server-session resolution already did.
 */
export function resolveApiBase(): string {
  const configured =
    process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api'
  return configured.startsWith('http') ? configured : `http://localhost:3001${configured}`
}
