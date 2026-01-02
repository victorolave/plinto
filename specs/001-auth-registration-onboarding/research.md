# Research: Authentication, Registration, and Tenant Onboarding

## Decision 1: OIDC via Web BFF with internal session JWT

**Decision**: Use the Web app to complete OIDC Authorization Code + PKCE, mint an internal Plinto JWT, and store it in an httpOnly session cookie that the API validates.

**Rationale**: Matches ADR 0003, keeps the API IdP-agnostic, and avoids exposing tokens in the browser.

**Alternatives considered**: API validates IdP tokens directly (rejected due to tight coupling); local username/password (rejected by PRD and ADR).

## Decision 2: Tenant context stored in session with last-used auto-selection

**Decision**: Persist active tenant in the application session; when multiple memberships exist, auto-select the last active tenant if still valid, otherwise require selection.

**Rationale**: Reduces friction while preserving explicit selection and tenant isolation.

**Alternatives considered**: Always prompt for selection (higher friction); fixed default tenant (less predictable, higher risk of mistakes).

## Decision 3: Local-only logout

**Decision**: Logout invalidates only the Plinto session; it does not trigger IdP logout.

**Rationale**: Simplifies MVP implementation while meeting session invalidation requirements.

**Alternatives considered**: Always federated logout (more complex, tighter IdP coupling); user choice of logout type (extra UX surface).

## Decision 4: Session invalidation behavior

**Decision**: If a session becomes invalid while a user is active, immediately deny access and require sign-in again.

**Rationale**: Clear security posture and avoids ambiguous recovery states.

**Alternatives considered**: Silent session refresh in the API (violates BFF separation); allow stale access until refresh (security risk).

## Decision 5: JIT user provisioning and onboarding

**Decision**: On first successful login, create a User with idp_sub, email, optional name, and created_at; require profile name and tenant creation before access.

**Rationale**: Aligns with PRD flow and keeps onboarding mandatory before any tenant-scoped access.

**Alternatives considered**: Pre-provision users (out of scope); allow access before tenant creation (breaks tenant isolation guarantees).

## Decision 6: Audit events for onboarding actions

**Decision**: Emit audit events for tenant creation and membership creation with tenant_id and request_id correlation.

**Rationale**: Aligns with ADR 0008 and builds traceability for critical access boundaries.

**Alternatives considered**: No audit for onboarding (rejected by constitution); log-only (insufficient audit trail).
