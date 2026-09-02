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
 * `NEXT_PUBLIC_API_BASE_URL` for these server-side calls.
 *
 * A relative configured value (e.g. `/api`) is anchored to an origin so it
 * becomes a fetchable absolute URL:
 *  - when the caller passes `requestUrl` (the incoming request this
 *    resolution is serving), it's anchored to THAT request's own origin —
 *    what a reverse-proxied self-host needs, since the public origin the
 *    browser reached the app on is the only correct origin for a relative
 *    API path in that setup;
 *  - otherwise it falls back to `http://localhost:3001`, the local dev
 *    default (this is also what happens with no config at all).
 */
export function resolveApiBase(options?: { requestUrl?: string }): string {
  const configured =
    process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api'

  if (configured.startsWith('http')) {
    return configured
  }

  if (options?.requestUrl) {
    return new URL(configured, options.requestUrl).toString().replace(/\/$/, '')
  }

  return `http://localhost:3001${configured}`
}
