# OIDC Provider Setup Guide

Plinto has no built-in identity provider — it is an OIDC *client*, and any
standard OpenID Connect provider works. This guide walks through configuring
two free options (Google, Auth0) end to end, then a shared troubleshooting
table. If you already know OIDC, skip to whichever provider section you need.

## 1. What Plinto needs from any provider

Plinto's web app (`apps/web/src/lib/auth/oidc-client.ts`) uses
[`openid-client`](https://github.com/panva/node-openid-client) and expects:

| Requirement | Detail |
| --- | --- |
| Discovery | `Issuer.discover(OIDC_ISSUER_URL)` fetches `<issuer>/.well-known/openid-configuration`. |
| Flow | Authorization code + PKCE (`code_challenge_method: S256`), plus a `state` value — both minted and cookie-checked per request (`apps/web/src/app/api/auth/login/route.ts`). |
| Client type | Confidential client: a client ID **and** a client secret. |
| Scopes | Exactly `openid email profile` (`login/route.ts` line 33). Plinto does not request `offline_access` or any other scope. |
| Required ID token claims | `sub` and `email`. If either is missing, the callback redirects straight back to `/login` **without logging anything** (`apps/web/src/app/(auth)/callback/route.ts` line 71) — see the troubleshooting table. |
| Optional claim | `name`, if present, is forwarded to the session-creation call; nothing breaks if it's absent (`callback/route.ts` line 92). |
| Refresh token | Optional. Read on if present, ignored if not — see below. |
| Redirect URI | `<PLINTO_PUBLIC_URL>/callback`, byte-for-byte, registered on the provider. |

### Refresh tokens: what their absence actually means

The callback route stores a `plinto_refresh_token` cookie only `if
(refreshToken)` is truthy (`callback/route.ts` lines 134–143) — a provider
that returns no refresh token simply results in no cookie, not an error.
More importantly: **nothing in this codebase currently reads that cookie to
mint a new session.** It is set at login and deleted at logout
(`apps/web/src/app/api/auth/logout/route.ts` line 50); there is no
`/api/auth/refresh` route or equivalent that exchanges it for a fresh token.

The practical consequence: your session's real lifetime is the internal
Plinto JWT's TTL, `JWT_TTL_SECONDS` in `apps/web/src/lib/auth/jwt.ts` — **8
hours**, hard ceiling — regardless of whether your provider ever issued a
refresh token. After 8 hours you log in again. Whether the provider hands
back a refresh token or not makes no difference to your day-to-day
experience today.

### The four environment variables

All four are read in `oidc-client.ts` and are required. They are checked
lazily, on the first login attempt rather than at startup: a missing one
makes the login route throw `Missing OIDC configuration`, and discovery runs
against the issuer on every login.

| Env var | Maps to |
| --- | --- |
| `OIDC_ISSUER_URL` | Passed to `Issuer.discover()` for metadata discovery. |
| `OIDC_CLIENT_ID` | `client_id` on the registered client. |
| `OIDC_CLIENT_SECRET` | `client_secret` on the registered client. |
| `OIDC_REDIRECT_URI` | Must equal `<PLINTO_PUBLIC_URL>/callback` and match what you register with the provider exactly. |

## 2. Google

Google is free and everyone already has an account, which makes it the
fastest provider to test with.

1. **Google Cloud Console → APIs & Services → OAuth consent screen.**
   - User type: **External**.
   - Fill in app name and a support email.
   - Publishing status **"Testing"** limits sign-in to up to 100 test users,
     which you add explicitly by email under "Test users" — anyone else
     gets blocked before reaching Plinto. **"In production"** removes that
     cap; Google's verification review is only required for *sensitive* or
     *restricted* scopes, and `openid`, `email`, `profile` are none of those,
     so you generally don't need to go through verification just to use
     Plinto with Google.
2. **Credentials → Create credentials → OAuth client ID.**
   - Application type: **Web application**.
   - Authorized redirect URIs: `<PLINTO_PUBLIC_URL>/callback` (e.g.
     `https://plinto.example.com/callback`). Google requires HTTPS here
     except for `http://localhost`.
   - Copy the generated **Client ID** and **Client secret**.
3. Set in `.env`:
   ```
   OIDC_ISSUER_URL=https://accounts.google.com
   OIDC_CLIENT_ID=<your client id>
   OIDC_CLIENT_SECRET=<your client secret>
   OIDC_REDIRECT_URI=<PLINTO_PUBLIC_URL>/callback
   ```

**Google specifics worth knowing before you configure this:**

- Google only returns a refresh token when the authorization request
  includes `access_type=offline`. Plinto's authorization request
  (`login/route.ts` lines 32–37) does not send `access_type` at all. So with
  Google, expect **no** refresh token — see [Refresh tokens](#refresh-tokens-what-their-absence-actually-means)
  above for what that means in practice (nothing changes; Plinto doesn't use
  the refresh token even when other providers supply one).
- Google's ID token includes `email` whenever the `email` scope is granted —
  which it always is here, since Plinto requests it — so the `sub`+`email`
  requirement is satisfied by any Google account.
- Google's ID token also includes `email_verified`. Plinto's callback does
  not check it (`callback/route.ts` line 71 checks only `claims.sub` and
  `claims.email`) — an unverified Google email still logs a user in.

## 3. Auth0

Auth0 is a generic, spec-compliant OIDC provider (per `docs/adr/0003-oidc-agnostic-auth-cookie-sessions-multitenancy.md`,
it was Plinto's original IdP) and its free tier is enough for a single
self-hosted instance.

1. **Auth0 Dashboard → Applications → Create Application → "Regular Web
   Applications."**
2. Under **Settings**, copy **Domain**, **Client ID**, **Client Secret**, and
   set:
   - **Allowed Callback URLs**: `<PLINTO_PUBLIC_URL>/callback`
   - **Allowed Logout URLs**: `<PLINTO_PUBLIC_URL>`
   - **Allowed Web Origins**: `<PLINTO_PUBLIC_URL>`
3. Under **Advanced Settings → Grant Types**, keep **Authorization Code**
   enabled. You can also enable **Refresh Token**, but read the note below
   before assuming that does anything for Plinto.
4. Set in `.env`:
   ```
   OIDC_ISSUER_URL=https://<your-tenant>.<region>.auth0.com/
   OIDC_CLIENT_ID=<your client id>
   OIDC_CLIENT_SECRET=<your client secret>
   OIDC_REDIRECT_URI=<PLINTO_PUBLIC_URL>/callback
   ```
5. **Users**: either enable the default **Authentication → Database →
   Username-Password-Authentication** connection and create users there, or
   add **Google** as a social connection so the same Google accounts from
   section 2 work through Auth0 instead.

**Auth0 specifics worth knowing:**

- Auth0's issuer URL conventionally has a trailing slash
  (`https://tenant.region.auth0.com/`). The slash does not matter for
  Plinto: `openid-client` builds the discovery URL correctly with or without
  it, and the `Issuer.discover()` call Plinto uses does not compare the
  issuer string you pass with the one in the discovery document (that check
  only exists in the library's `webfinger()` path, which Plinto never
  calls).
- Auth0 only issues a refresh token when the authorization request includes
  the `offline_access` scope **and** the application/API is configured to
  allow offline access. Plinto's scope string is exactly `openid email
  profile` (`login/route.ts` line 33) — no `offline_access`. So, same as
  Google, expect Auth0 not to return a refresh token here regardless of the
  Grant Types toggle in step 3; it is a no-op for Plinto's current request.

## 4. Local development without HTTPS

For a local trial on `http://localhost:3000`, both providers above work with:

```
PLINTO_PUBLIC_URL=http://localhost:3000
OIDC_REDIRECT_URI=http://localhost:3000/callback
COOKIE_SECURE=false
```

`COOKIE_SECURE=false` is required — see `isSecureCookie()` in
`apps/web/src/lib/auth/cookie-options.ts`: it defaults to `true` whenever
`NODE_ENV=production`, and a `Secure` cookie is silently dropped by the
browser on plain HTTP, which looks like a successful login that bounces
straight back to `/login`.

Google accepts `http://localhost` as a redirect URI exception; it does
**not** accept plain HTTP on any other hostname or IP. Auth0 accepts any
callback URL you register, including non-localhost HTTP, but treat that as a
local-only convenience — never run a real deployment without HTTPS.

## 5. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Login succeeds at the provider, but you land back on `/login` with no error | `COOKIE_SECURE=true` (the default under `NODE_ENV=production`) while serving plain HTTP — the browser refuses to store the `Secure` session cookie | Set `COOKIE_SECURE=false` until you're behind HTTPS, then flip it back (see [`docs/delivery/self-host.md`](./self-host.md#the-cookie_secure-gotcha)) |
| Provider shows `redirect_uri_mismatch` | The registered callback URL and `OIDC_REDIRECT_URI` don't match byte-for-byte (scheme, host, port, trailing path) | Compare both values character by character; they must equal `<PLINTO_PUBLIC_URL>/callback` exactly |
| Provider shows `invalid_client` | Client secret pasted with a leading/trailing space, or credentials from the wrong tenant/project | Re-copy the secret and issuer URL directly from the provider console, no manual retyping |
| The provider accepts the login, Plinto bounces to `/login` and logs **nothing** | The ID token is missing `sub` or `email` — e.g. an Auth0 connection or rule that strips `email`, or an identity source with no email address on the account | Confirm the `email` scope is granted and the identity source returns an email; the silent redirect is `callback/route.ts` line 71 |
| Plinto logs `[Callback] ... stage: 'oidc_discovery'` on login | `OIDC_ISSUER_URL` has a typo, points at the wrong environment, or is missing a required path segment (some providers, unlike Auth0/Google, need the full realm path) | `curl <OIDC_ISSUER_URL>/.well-known/openid-configuration` (try with and without a trailing slash) and confirm it returns JSON |
| Google shows "This app isn't verified" | The OAuth consent screen is in **Testing** publishing status and your account isn't in the test user list | Add your Google account under **Test users** on the consent screen, or move to **In production** |
| Stuck at 100 test users on Google | **Testing** mode caps test users at 100 | Move the consent screen to **In production** (verification is not required for the `openid email profile` scopes Plinto uses) |

## 6. See also

- [`docs/delivery/self-host.md`](./self-host.md) — full self-host operator
  guide (Docker Compose, `COOKIE_SECURE`, backups, upgrades).
- `deploy/self-host.env.example` — the annotated env template referenced
  throughout this guide.
- [`docs/adr/0003-oidc-agnostic-auth-cookie-sessions-multitenancy.md`](../adr/0003-oidc-agnostic-auth-cookie-sessions-multitenancy.md)
  — why Plinto is OIDC-agnostic and cookie-session based.
