# ADR 0007: Authorization (RBAC), Tenant Permissions, and Access Limits

- **Status**: Accepted
- **Date**: 2025-12-30
- **Deciders**: Plinto Maintainer(s)
- **Context**: Access control in a multi-tenant system (SaaS and self-host)

## Context

Plinto is a **multi-tenant** system: multiple households/families (tenants) can share the same infrastructure (SaaS) without seeing each other's data. Additionally, in self-host mode, the same security model must apply.

Access control must:
- guarantee isolation by `tenant_id`
- allow simple roles initially (without over-engineering)
- scale toward finer permissions without rewriting everything
- remain agnostic of the identity provider (OIDC), since identity only answers "who is the user", not "what can they do"

## Decision

### 1. Tenant-Based Authorization (Mandatory)

Every operation on business data requires:
1) a `tenant_id` resolved for the request
2) an **active membership** of the user in that tenant

Without a valid tenant or membership:
- the request is rejected (401/403 as appropriate)

### 2. Minimal Role Model (RBAC)

Simple RBAC per tenant is adopted via `Membership.role`.

Initial roles:
- `owner`: full control of the tenant (configuration, members, data)
- `member`: can manage financial data of the tenant
- `viewer` (optional): read-only

Roles are always evaluated in the context of a tenant.

### 3. Permissions (Actions) as Evolution Layer

Although initial control is by role, a conceptual permission layer is defined to scale without breaking compatibility:

- Typical actions (examples):
  - `tenant:manage`
  - `member:invite`
  - `account:write`
  - `transaction:write`
  - `transaction:read`
  - `report:read`

Initially, actions are mapped to roles via a static table (code-based).
In the future, the system can evolve to configurable permissions without changing the authorization contract.

### 4. Principle of Least Privilege

- Endpoints must require the minimum necessary permission.
- Any endpoint not explicitly classified is considered restricted.
- No "global" access to multi-tenant data exists.

### 5. Separation Between Authentication and Authorization

- Authentication determines **who** the user is (valid session).
- Authorization determines **what** they can do in a tenant (membership + role/permissions).

These layers are not mixed and must be tested separately.

## Consequences

### Positive
- Robust isolation between tenants.
- Simple model for MVP (roles) with a clear path to the future (actions/permissions).
- Less risk of scattered "if role === owner": centralization of rules.
- Better maintainability and auditability.

### Negative / Trade-offs
- Requires discipline for all endpoints to apply tenant and permission checks.
- The `viewer` role adds complexity if implemented too early.

### Mitigations
- Central guard/middleware that resolves tenant and validates membership.
- Helpers/Policy layer to require permissions per endpoint.
- Authorization tests:
  - cross-tenant access must fail
  - role-based access must match policy

## Alternatives Considered

1. Full ABAC (attribute-based policies) from the start:
   - Rejected due to premature complexity.

2. Fully configurable permissions in DB from the start:
   - Rejected due to over-engineering for the current stage.

3. Authorization solely by roles without permissions:
   - Acceptable for MVP, but the action layer is documented to scale.

## Implementation Notes (High Level)

- A `TenantContext` is resolved per request.
- A central `AuthorizationPolicy` maps roles → allowed actions.
- The persistence layer always filters by `tenant_id`, but that does not replace authorization checks (both are necessary).

