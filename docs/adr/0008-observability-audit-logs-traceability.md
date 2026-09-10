# ADR 0008: Observability and Auditing (Logs, Traceability, and Audit Trail)

- **Status**: Accepted — **partially implemented**. The audit trail is built;
  structured logging is not. See the amendment at the end.
- **Date**: 2025-12-30
- **Deciders**: Plinto Maintainer(s)
- **Context**: Traceability, debugging, and trust in a multi-tenant financial system

## Context

Plinto manages sensitive financial data for multiple tenants (households/families) in SaaS and self-host modes. To operate the system reliably and explain behaviors to users and maintainers, it is necessary to have:

- Observability: know what failed, where, and why.
- Auditing: know who did what, when, and in which tenant.

Both capabilities must:
- respect multi-tenant isolation
- avoid exposure of sensitive data
- remain simple and sustainable
- work the same in SaaS and self-host

## Decision

### 1. Observability (Logs and Traceability)

A strategy of **minimal but sufficient observability** is adopted:

- Structured logs (JSON).
- Each HTTP request has a `request_id`.
- Each background job has a `job_id`.
- `request_id` / `job_id` are propagated to:
  - logs
  - errors
  - audit events

Logs include at minimum:
- timestamp
- level (info, warn, error)
- `tenant_id` (when applicable)
- `request_id` or `job_id`
- human-readable message
- relevant metadata (without sensitive data)

Not logged:
- tokens
- cookies
- credentials
- unnecessary complete financial payloads

### 2. Auditing (Audit Trail)

An **explicit audit log** is implemented for relevant domain actions.

Audited:
- financial operations:
  - creation, modification, or deletion of transactions
  - transfers
  - executions of recurring operations
  - imports that create movements
- sensitive configuration changes:
  - tenant base currency
  - member management (invite, remove, change role)

Not audited:
- reads
- navigation
- purely visual/UI actions

### 3. Content of an Audit Event

Each audit event includes:

- `tenant_id`
- `actor`:
  - `user_id`, or
  - `system` (background job)
- `action` (e.g., `transaction.create`)
- `resource` (type and id, when applicable)
- `timestamp`
- `source`:
  - `manual`
  - `job`
  - `import`
- `correlation_id`:
  - `request_id` or `job_id`

The goal is to **explain what happened**, not to reconstruct the complete state (event sourcing is out of scope).

### 4. Background Jobs and Auditing

Background jobs:
- act as an explicit actor (`system`)
- generate audit events for financial operations
- include their `job_id` as `correlation_id`

This allows tracing:
- which job executed an action
- when
- for which tenant

### 5. Access to Auditing

- Audit events are **isolated by tenant**.
- Only users with appropriate role (e.g., `owner`) can consult tenant audit.
- No global cross-tenant access to events exists.

### 6. Retention

- Logs:
  - short/medium retention (operational)
- Auditing:
  - long retention (historical)

Retention policies may vary between SaaS and self-host, but the data model is the same.

## Consequences

### Positive
- Ability to explain and debug financial errors.
- Greater user trust in the system.
- Clear traceability between requests, jobs, and state changes.
- Solid foundation for SaaS support and operation.

### Negative / Trade-offs
- Additional storage cost for auditing.
- Discipline required to register events correctly.

### Mitigations
- Audit only relevant actions.
- Keep payloads small and structured.
- Do not duplicate information already persisted in the domain.

## Alternatives Considered

1. **No audit log**
   - Rejected due to inability to explain financial changes.

2. **Complete event sourcing**
   - Rejected due to excessive complexity for current scope.

3. **Logs as sole source**
   - Rejected due to lack of structure and adequate retention.

## Implementation Notes (High Level)

- Centralize creation of audit events.
- Require `tenant_id` in every event.
- Ensure propagation of `request_id` and `job_id`.
- Avoid logging/auditing sensitive information.


---

## Amendment (2026-09-10) — what is built and what is not

Audited against the code. The two halves of this ADR did not land together.

### Built, and matching this record

The **audit trail**. `AuditEvent` carries `tenant_id`, actor, action, source
and `correlationId`, and financial operations write to it. This is the half
that matters for answering "who changed this and when", and it works.

`request_id` is generated per request (`apps/api/src/common/middleware/request-id.middleware.ts`),
returned in the response header, and surfaced as `traceId` on error responses.

### Not built

**Logs are not structured.** The API uses Nest's default logger with
interpolated text messages. There is no JSON output, and `request_id` and
`job_id` are never attached to log lines — the correlation this document
describes exists in the audit table and in error responses, but not in the
logs themselves.

The practical consequence for anyone operating a self-hosted instance: when
something goes wrong, you can see *that* it went wrong and you can read the
audit trail afterwards, but you cannot filter a log stream by request and
follow one operation through it. That is a real gap in a system that moves
money, and it is why this is recorded here rather than quietly dropped.

Tracked in the [roadmap](../roadmap.md#5-structured-logs-with-correlation).
