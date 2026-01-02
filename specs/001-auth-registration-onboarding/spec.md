# Feature Specification: Authentication, Registration, and Tenant Onboarding

**Feature Branch**: `001-auth-registration-onboarding`  
**Created**: 2026-01-01  
**Status**: Draft  
**Input**: User description: "develop the feature defined on PRD-001-authentication-registration-tenant-onboarding.md develop the features for the frontend and the backend following the specifications defined on the adrs located on docs/adr. And remember follow clean arch in both projects"

## Clarifications

### Session 2026-01-01

- Q: Should logout invalidate only the Plinto session or also perform federated IdP logout? → A: Local-only logout (invalidate Plinto session only).
- Q: When a user has multiple tenants, should the system remember and auto-select the last active tenant? → A: Remember and auto-select the last active tenant if membership is still valid.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - First-time sign-in and onboarding (Priority: P1)

A new user signs in with an external identity provider, completes their profile, creates their first household, and lands in the app ready to work.

**Why this priority**: Without this flow, no one can start using Plinto in a tenant-safe way.

**Independent Test**: Can be fully tested by signing in as a new user, completing profile + tenant setup, and verifying access to the empty dashboard.

**Acceptance Scenarios**:

1. **Given** a person with a valid identity provider account and no existing Plinto user, **When** they sign in, **Then** a new user record is created and they are taken to onboarding.
2. **Given** a user in onboarding without a completed name, **When** they submit a name and tenant details, **Then** their profile is completed, a tenant is created, and they become the tenant owner.
3. **Given** a user who completes onboarding, **When** they continue, **Then** they see the app with an active tenant context.

---

### User Story 2 - Returning user with one tenant (Priority: P2)

An existing user signs in and immediately resumes work in their household without extra steps.

**Why this priority**: This is the primary daily experience for most users.

**Independent Test**: Can be fully tested by signing in as an existing user with a single tenant and verifying auto-selection + access.

**Acceptance Scenarios**:

1. **Given** a user who belongs to exactly one tenant, **When** they sign in, **Then** that tenant is automatically selected and they are taken to the dashboard.
2. **Given** a user with an active session that has expired, **When** they access a protected page, **Then** they are redirected to sign in.

---

### User Story 3 - Returning user with multiple tenants (Priority: P3)

A user who belongs to more than one household chooses which tenant to use before accessing the app.

**Why this priority**: Multi-tenant support is a core security boundary even if most users start with one tenant.

**Independent Test**: Can be fully tested by signing in as a user with multiple memberships and selecting an active tenant.

**Acceptance Scenarios**:

1. **Given** a user who belongs to multiple tenants, **When** they sign in, **Then** they are prompted to select an active tenant before accessing the app.
2. **Given** a user selects a tenant they do not belong to, **When** they attempt to proceed, **Then** access is denied and they remain without an active tenant.

---

### Edge Cases

- What happens when the identity provider does not supply an email address?
- How does the system handle a user who abandons onboarding and returns later?
- What happens when a tenant is created without a base currency specified?
- How does the system respond to a request with a missing or invalid tenant context?
- What happens when a session is invalidated while the user is actively using the app?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow users to sign in or register via an external identity provider.
- **FR-002**: The system MUST NOT collect or store user passwords.
- **FR-003**: On first successful sign-in, the system MUST create a user record with identity subject, email, name (if provided), and creation timestamp.
- **FR-004**: The system MUST require users to complete their profile name before accessing the application.
- **FR-005**: The system MUST require creation of a first tenant during onboarding with a name and base currency.
- **FR-006**: The system MUST default the base currency to COP when not specified by the user.
- **FR-007**: The system MUST create a membership that links the user to the tenant with the owner role.
- **FR-008**: The system MUST block access to all tenant-scoped functionality until an active tenant is selected.
- **FR-009**: The system MUST automatically select the tenant when the user belongs to exactly one tenant.
- **FR-010**: The system MUST require the user to explicitly select an active tenant when multiple memberships exist.
- **FR-010a**: The system MUST auto-select the last active tenant for users with multiple memberships when still valid; otherwise, require selection.
- **FR-011**: The system MUST reject requests that lack a valid tenant context or active membership.
- **FR-012**: The system MUST prevent users from accessing data belonging to other tenants.
- **FR-013**: The system MUST provide a logout action that invalidates the application session only (no IdP logout).
- **FR-014**: The system MUST record audit events for tenant creation and membership creation with tenant context.
- **FR-015**: The system MUST present clear states for no session, incomplete onboarding, and invalid tenant access.

### Assumptions

- The identity provider returns a stable subject identifier and a verified email address for each user.
- Invitation and role management beyond the initial owner are out of scope for this feature.
- The initial tenant role set is limited to owner for the creating user.

### Dependencies

- A trusted external identity provider is configured for sign-in and registration.

### Out of Scope

- Inviting additional members or changing roles after tenant creation.
- Account recovery flows and multi-factor authentication.
- Financial data creation (accounts, transactions, or reports).

### Key Entities *(include if feature involves data)*

- **User**: A person with an external identity, profile name, and contact email.
- **Tenant**: A household/family workspace with a name and base currency.
- **Membership**: The relationship between a user and a tenant with a role (owner).
- **Session**: The application access context that links a user to an active tenant.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: New users complete sign-in, profile completion, and tenant creation in under 2 minutes on average.
- **SC-002**: 100% of authenticated requests without a valid tenant context are rejected.
- **SC-003**: At least 95% of first-time users complete onboarding on their first attempt without support.
- **SC-004**: After logout, protected pages are no longer accessible within 5 seconds.
