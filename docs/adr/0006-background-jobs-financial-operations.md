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

## Amendment (2026-09-02)

**The obligations engine now runs from an in-process scheduler inside the
API**, enabled per instance by `JOBS_SCHEDULER_ENABLED`. This supersedes two
things decided above: the requirement that these jobs execute in a worker
separate from the API, and the rejection of "system cron" as an approach for
generation and recurring execution specifically.

### What changed

- `ScheduledJobsService` (`apps/api/src/modules/jobs/`) registers a
  `CronJob` via `@nestjs/schedule`'s `SchedulerRegistry` when
  `JOBS_SCHEDULER_ENABLED=true`. On each tick it calls
  `ObligationGenerationService.generate` and then
  `RecurringExecutionService.executeDue` — the same two services the
  internal HTTP endpoints call, in the same order.
- The internal endpoints (`POST /api/internal/obligations/generate`,
  `POST /api/internal/recurring/execute`) are unchanged and remain the
  manual/backfill path: verifying a deploy, catching up a missed period, or
  driving the engine from outside the API entirely.
- The `scheduled-jobs` GitHub Actions workflow is unchanged in behavior. It
  is now the **fallback driver** for deployments that leave the in-process
  scheduler off, and is redundant (safe to disable) once
  `JOBS_SCHEDULER_ENABLED=true` on an instance.

### Why this doesn't contradict the original decision

The original rejection of "system cron" was about **portability and
observability** for a job queue backing every financial operation (imports,
transfers, retries) — a fair concern for that scope. Generation and
recurring execution are a narrower case, and three things specific to them
changed the calculus:

1. **Self-host needs a driver that ships with the product.** Plinto targets
   both SaaS and self-host (see Context above). A self-hosted install has no
   guaranteed external scheduler — asking an operator to wire up their own
   cron, systemd timer, or GitHub Actions secrets before the engine runs at
   all is a worse default than shipping one that works out of the box.
2. **GitHub Actions crons are disabled after 60 days of repository
   inactivity.** That makes the workflow a fine primary driver for an
   actively-developed SaaS repo, but a silent single point of failure for a
   self-hosted fork that sees little repository activity — the engine would
   simply stop running, with no error, until someone noticed a period never
   got materialized.
3. **Idempotency by DB uniqueness makes duplicate ticks harmless.** Both
   operations are already idempotent by unique index (obligations by
   `(rule, period)`, recurring executions by `(rule, period)` key) — the same
   guarantee the workflow already relies on for retries and manual runs. A
   second scheduler ticking concurrently, or a scheduled tick overlapping a
   manual internal-endpoint call, converges to the same state; it does not
   risk the duplication problem "system cron" was originally rejected over.

The operational requirement this creates: **enable
`JOBS_SCHEDULER_ENABLED=true` on exactly one replica** per environment. Every
replica ticking would be safe (idempotent) but wasteful — needless load on
the database for work only one of them needs to do.

