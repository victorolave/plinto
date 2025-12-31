# ADR 0003: OIDC-Agnostic Authentication, Cookie-Based Sessions, and Multi-Tenancy

- **Status**: Accepted
- **Date**: 2025-12-30
- **Deciders**: Plinto Maintainer(s)
- **Context**: Authentication, authorization, and SaaS + self-host support

## Context

Plinto aims to operate in two modes:

1. **SaaS** multi-tenant, operated by the team/maintainer.
2. **Self-hosted**, where users deploy their own instance.

The system must:
- Handle user identity securely.
- Support multiple households/families (tenants) with strict data isolation.
- Avoid coupling business logic to a specific authentication provider.
- Use sessions based on **httpOnly cookies** (no tokens in the browser).
- Minimize security risks and long-term technical debt.

A solution is required that allows changing the initial identity provider (Auth0) to another compatible one (e.g., Keycloak, Cognito, Okta) without significant changes to the application code.

## Decision

### 1. Identity Protocol

**OpenID Connect (OIDC)** is adopted as the standard authentication interface.

- Plinto does not implement its own login flows.
- The application trusts identity issued by an **Identity Provider (IdP)** compatible with OIDC.
- **Auth0** will be the initial IdP, but the architecture will be **provider-agnostic**.

The system depends solely on:
- OIDC discovery (`/.well-known/openid-configuration`)
- signed tokens (JWT)
- standard claims (`sub`, `email`, etc.)

### 2. Cookie-Based Session Management (BFF Pattern)

A **BFF (Backend for Frontend)** pattern is adopted with application-owned sessions:

- **Next.js (Web)**:
  - Implements the Authorization Code Flow (with PKCE).
  - Interacts with the OIDC IdP.
  - Receives tokens from the IdP (id/access/refresh).
  - Creates and manages a **Plinto-owned session cookie**.

- **NestJS (API)**:
  - Does not implement OIDC flows.
  - Consumes already authenticated identity.
  - Applies authorization and multi-tenancy.

The session cookie:
- is **httpOnly**
- is **Secure** in production
- has **short TTL**
- represents the application session, not the IdP session

### 3. Internal Application Token

To decouple the API from the OIDC provider:

- Next.js issues an **internal Plinto JWT** when creating the session.
- This token contains only minimal claims:
  - `sub`: internal user identifier
  - `idp_sub`: IdP subject
  - `tenant_id` (optional, depending on strategy)
- The token is stored in the session cookie.
- The API validates this token without depending on external IdP JWKS.

Changing IdP only affects the login module in Next.js, not the API.

### 4. Session Duration and Refresh

- **Plinto session (cookie)**:
  - Short TTL (e.g., 30 minutes).
  - Automatic renewal while the IdP refresh token is valid.

- **IdP tokens**:
  - `access_token`: short (e.g., 5–15 minutes).
  - `refresh_token`: long, stored only server-side (Next.js).

Refresh flow:
1. Cookie expires or is about to expire.
2. Next.js uses the refresh token to obtain new tokens from the IdP.
3. A new Plinto session cookie is issued.
4. If refresh fails, logout is forced.

Auth0 (or any IdP) manages **its own identity session**, but not the Plinto session.

### 5. Logout

Two types of logout are supported:

- **Local logout**:
  - Invalidates the Plinto session cookie.
  - Does not close the session in the IdP.

- **Federated logout**:
  - Redirects to the IdP logout endpoint.
  - Invalidates tokens and identity session.

The choice depends on context and desired UX.

### 6. Multi-Tenancy Model

An explicit model is adopted:

- `User`: global identity.
- `Tenant`: household/family that owns data.
- `Membership`: user–tenant relationship with role.

Isolation strategy:
- All persistent entities include `tenant_id`.
- All queries are filtered by `tenant_id`.
- Composite indexes by `tenant_id`.

### 7. Tenant Resolution

- Tenant context is resolved on each request.
- Initial mechanism:
  - Explicit header (`X-Tenant-Id`) or
  - Context persisted in the session.
- The API rejects requests without a valid tenant.

### 8. Authorization

**Minimal RBAC** is adopted:

- Initial roles:
  - `owner`
  - `member`
  - `viewer` (optional)
- The API validates:
  - valid session
  - active membership
  - sufficient role for the requested action

### 9. Devices and Sessions

- Plinto is responsible for application session management.
- The system can register active sessions:
  - session_id
  - user_id
  - tenant_id
  - basic metadata (UA, timestamps)

This enables:
- logout by device
- logout all sessions
- basic audit

Auth0 only manages sessions at the identity level, not at the application level.

## Consequences

### Positive
- Architecture decoupled from identity provider.
- Easy migration between OIDC IdPs.
- Secure sessions via cookies (no tokens in localStorage).
- Solid foundation for SaaS and self-host.
- Clear separation of responsibilities (Web vs API).

### Negative / Trade-offs
- Higher initial complexity than simple local auth.
- Need to maintain own session logic.
- Two concepts of session (IdP vs application).

### Mitigations
- Use of standards (OIDC, JWT).
- Centralized and well-documented session logic.
- Incremental implementation (session registration optional in MVP).

## Alternatives Considered

1. **Local auth (email/password in API)**  
   Rejected due to higher security risk and lower portability.

2. **Bearer tokens in localStorage**  
   Rejected due to XSS risks and worse UX.

3. **API validating IdP tokens directly**  
   Rejected due to greater coupling to the provider.

## Implementation Notes

- IdP configuration via standard variables:
  - `OIDC_ISSUER_URL`
  - `OIDC_CLIENT_ID`
  - `OIDC_CLIENT_SECRET`
  - `OIDC_REDIRECT_URI`
- Do not hardcode providers or endpoints.
- Maintain minimal and stable identity contracts.

