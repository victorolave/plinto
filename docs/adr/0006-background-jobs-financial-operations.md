# ADR 0006: Background Jobs for Financial Operations (Recurring, Imports, and Transfers)

- **Status**: Accepted
- **Date**: 2025-12-30
- **Deciders**: Plinto Maintainer(s)
- **Context**: Reliability when executing financial operations without duplicates

## Context

In Plinto, a **financial operation** is any action that changes the "truth" of the system: creates/edits/deletes transactions, executes recurring operations, imports movements, or performs transfers. These operations:

- cannot be executed twice by error
- must not fail "halfway"
- must respect `tenant_id` (multi-tenancy)

Additionally, Plinto must work in both **SaaS** and **self-host** modes, with consistent behavior.

## Decision

1. **Automatic or heavy** financial operations will be executed as **background jobs** (outside the HTTP request).
2. A job queue will be used for:
   - recurring expenses/income
   - imports (CSV / future integrations)
   - transfers and processes that may require retries
3. Each job must be **idempotent**:
   - before creating a transaction, it verifies if it was already created for that event
   - retries cannot produce duplicates
4. Each job explicitly includes `tenant_id` and validates the context before operating.
5. The creation/modification of transactions is executed within **database transactions**.

## What Goes to Background Jobs

- Execute a monthly recurring expense (create the month's transaction)
- Import movements and deduplicate
- Create a transfer (and its pair of movements)
- Recalculate aggregates or generate notifications (derived)

## What Does NOT Go to Background Jobs

- Reads: dashboards, reports, listings
- Simple actions that only save configuration (e.g., "create a recurring rule" without creating transactions)

## Consequences

### Positive
- Less risk of duplicates in transactions.
- Safe retries in case of failures.
- Better UX (fast requests; heavy work outside the request).
- Solid foundation for future features.

### Negative / Trade-offs
- Higher operational complexity (job service + worker).
- Requires discipline in idempotency.

### Mitigations
- Internal standard for idempotency (deterministic keys per event).
- Tests that ensure tenant isolation and absence of duplicates.
- Logs by `tenant_id` and `job_id`.

## Alternatives Considered

1. Execute everything in request/response:
   - Rejected due to risk of duplication, timeouts, and partial failures.
2. System cron:
   - Rejected due to limited portability and observability.

## Implementation Notes (High Level)

- Jobs must execute in a worker separate from the API.
- Financial operations: always transactional in DB.
- Idempotency: prior verification + execution keys/refs.

