# PRD 001: Authentication, Registration, and Tenant Onboarding

## Status
Implemented (OIDC sign-in, sessions, household creation and onboarding
all shipped; see the [changelog](../../CHANGELOG.md))

## Objective

Enable a person to register/sign in and start using Plinto securely, ensuring from the very beginning isolation between families/households (tenants).

Upon completion of this PRD, **two different families must be able to use the same Plinto instance without seeing each other's data**.

---

## Problem

Before registering expenses or income, Plinto needs to resolve:

- who the user is
- which family/household they belong to
- under which tenant all operations are executed

Without this, any financial functionality lacks context and security.

---

## Users

- **Primary user**: person who creates their first household/family in Plinto.
- **Future users**: members invited to a tenant (out of scope in this version).

---

## Scope (In Scope)

### 1. Authentication (login / identity registration)

- Authentication is delegated to an **OIDC Identity Provider**.
- Auth0 will be the initial provider.
- Plinto does not manage passwords or credentials.

Supported:
- login
- account registration
- logout

---

### 2. Registration in Plinto (Just-in-Time Provisioning)

- On the **first successful login**, if the user does not exist in the database:
  - Plinto automatically creates a `User` record.
- The user is authenticated and ready for onboarding.

Minimum user data:
- `idp_sub`
- `email`
- `name` (may be optional from IdP, must be completed during onboarding)
- `created_at`

---

### 3. Onboarding: profile completion and creation of the first tenant

After the first login:

- The user must complete their **profile**:
  - `name` (required, may be pre-filled from IdP)
- The user must create their first **Tenant** (family/household).
- The user automatically becomes:
  - `owner` of the tenant
- The tenant requires:
  - `name`
  - `base_currency` (default: COP)

Access to system functionality is not allowed without an active tenant.

---

### 4. Active tenant selection

- If the user belongs to a single tenant:
  - it is automatically selected.
- If they belong to multiple tenants (future):
  - they must select the active tenant.

The active tenant defines:
- the `tenant_id` of all requests
- the authorization and data context

---

### 5. Session

- User session is managed via **httpOnly cookies**.
- The backend always receives a user + tenant context.
- Logout invalidates the Plinto session (and optionally the IdP session).

---

### 6. Isolation and security

- No user can:
  - access other tenants
  - create or read data without `tenant_id`
- Every request requires:
  - valid session
  - valid tenant
  - active membership

---

## Out of Scope

> **Amended 2026-09-10.** The first three items were out of scope *for this
> document* and were built afterwards, without a PRD of their own. They are
> listed here as delivered so this section stops reading as a description of
> what the product lacks.

- ~~Invitations to other users~~ — **delivered.**
  `GET`/`POST`/`DELETE /api/members/invitations`, with the web flow under
  `apps/web/src/features/members/`.
- ~~Advanced member management~~ — **delivered.** Listing and removing members.
- ~~Role changes~~ — **delivered.** Owner, member and viewer roles, enforced by
  the RBAC policy in [ADR 0007](../adr/0007-authorization-rbac-tenant-permissions.md).
- Account recovery
- MFA (delegated to IdP)
- Accounts, transactions, or financial data

One account belonging to **several households** was also written here as a
future concern. It is delivered: households are listed per user and switched
without signing in again.

---

## Main Flow (Happy Path)

1. User enters Plinto.
2. They are redirected to the IdP for login/registration.
3. They return authenticated.
4. Plinto:
   - creates the `User` if it doesn't exist.
5. User completes their profile (name).
6. User creates their first tenant.
7. Tenant becomes active.
8. User accesses the system (empty dashboard).

---

## Errors and States

- No session → redirect to login.
- With session but no tenant → mandatory onboarding.
- Invalid tenant or no membership → access denied (403).

---

## Acceptance Criteria

- [ ] A user can register and sign in.
- [ ] On first login, the `User` is automatically created.
- [ ] The user must complete their profile (name) during onboarding.
- [ ] The user can create a tenant and becomes `owner`.
- [ ] All subsequent requests include `tenant_id`.
- [ ] A user cannot access data from another tenant.
- [ ] Logout correctly invalidates the session.
- [ ] Audit logs include `tenant_id` when applicable.

---

## Success Metrics

- Time from login to tenant created < 2 minutes.
- Zero cross-tenant accesses.
- Flow understandable without external documentation.

---

## Technical Notes

- Authentication: OIDC (Auth0 initially, agnostic by design).
- Session: httpOnly cookies.
- Authorization: minimal RBAC (`owner`).
- Audit and logs per ADR 0008.

