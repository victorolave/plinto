# Quickstart: Authentication, Registration, and Tenant Onboarding

## Prerequisites

- OIDC provider configured with redirect URI for the Web app.
- Environment variables set (see `.env.example`):
  - OIDC_ISSUER_URL
  - OIDC_CLIENT_ID
  - OIDC_CLIENT_SECRET
  - OIDC_REDIRECT_URI
  - INTERNAL_API_KEY
  - JWT_SECRET (must be the same in Web and API)
  - DATABASE_URL
  - NEXT_PUBLIC_API_BASE_URL
- Database available and migrations applied.

## Manual Verification

1. Open the Web app and attempt to access a protected route.
2. Confirm you are redirected to the IdP login/registration screen.
3. Complete login as a new user and return to the app.
4. Complete profile name and create a tenant with a base currency.
5. Verify the dashboard loads with an active tenant context.
6. If multiple tenants exist, ensure the tenant selection screen appears.
7. Log out and confirm protected routes require sign-in again.

## Multi-Tenant Check

1. Create a second tenant for the same user (if enabled for testing).
2. Sign in again and confirm the last active tenant auto-selects.
3. Switch active tenant and confirm the change persists for the next sign-in.

## Session Refresh Verification

1. Stay logged in for more than 20 minutes.
2. Verify session remains active (automatic refresh).
3. Make API requests and verify they succeed without manual re-authentication.
