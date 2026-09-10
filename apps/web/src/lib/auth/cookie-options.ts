/**
 * Whether session cookies should carry the `Secure` attribute.
 *
 * Defaults to `NODE_ENV === 'production'`, but `COOKIE_SECURE` can override
 * it explicitly. This matters for self-host: an operator running Plinto over
 * plain HTTP on a LAN host (no TLS terminator in front of it) still builds
 * with `NODE_ENV=production`, and a `Secure` cookie on a non-HTTPS origin is
 * silently dropped by the browser — the user is bounced straight back to
 * login after a successful OIDC callback, with no error to explain why.
 * `COOKIE_SECURE=false` lets that operator opt out of the production
 * default without weakening it for everyone else.
 */
export function isSecureCookie(): boolean {
  const override = process.env.COOKIE_SECURE

  if (override === undefined) {
    return process.env.NODE_ENV === 'production'
  }

  if (override === 'true') {
    return true
  }

  if (override === 'false') {
    return false
  }

  throw new Error(
    `Invalid COOKIE_SECURE value "${override}": expected "true", "false", or unset.`,
  )
}
