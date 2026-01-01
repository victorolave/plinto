# Plinto Constitution

Plinto replaces household finance spreadsheets with a structured system that is
accurate, explainable, and supportive—helping families understand their
situation, build healthier habits, and make better decisions over time.

This constitution codifies non-negotiables derived from `docs/prd/*` and
`docs/adr/*`. When in doubt: choose the option that increases user trust and
reduces financial ambiguity.

## Core Principles

### I. Financial Correctness Is Sacred
- Money is stored as `amount_minor` integers + explicit `currency` (ISO 4217); never floats/decimals for amounts.
- Accounts have exactly one currency; transactions inherit the account currency; mismatches are rejected.
- Derived views (balances, reports) are never treated as source of truth.
- Critical operations are atomic (DB transactions), auditable, and never leave partial states.

### II. Multi-Tenancy Is the Default Security Boundary
- Every business entity and audit event includes `tenant_id`.
- Every request resolves tenant context and requires active membership.
- Cross-tenant access is impossible by design (filter-by-tenant everywhere + authorization guards).

### III. Explicit, Explainable FX (No Magic Conversion)
- Currencies are never mixed implicitly in UI, totals, or reports.
- Cross-currency transfers are modeled as two linked transactions + explicit FX metadata (rate, fees, source).
- Manual rates are acceptable initially; future providers must not break the model or traceability.

### IV. Traceability Builds Trust
- Financial operations (create/edit/delete transactions, transfers, recurring executions, imports) emit audit events.
- Every request/job has a correlation id (`request_id`/`job_id`) propagated to logs, errors, and audit events.
- Logs and audits avoid sensitive data (tokens, cookies, unnecessary full financial payloads).

### V. Contract-First REST With Runtime Validation
- REST is the initial API style.
- Zod schemas in `packages/shared` are the source of truth for request/response contracts.
- API and Web share schemas; errors follow a stable, uniform structure.
- Breaking contract changes require versioning strategy (`/api/v1`…).

### VI. Background Jobs for Automatic or Critical Operations
- Transfers and recurring executions run as background jobs, not inside the HTTP request/response.
- Jobs are idempotent (deterministic keys) and safe to retry without duplicates.
- Jobs always validate `tenant_id` context before mutating data.

### VII. SaaS and Self-Host Parity
- One codebase, two modes: SaaS and self-host; differences live in config/infrastructure only.
- Deployment is containerized (Docker), fronted by Nginx, with Web and API under the same site to support cookies safely.
- Schema changes are via migrations only; no manual production DB edits.

### VIII. Calm, Accessible UX Over Dense Power-User UI
- The UI prioritizes clarity, accessibility, and explainability (Radix UI patterns; shadcn/ui + Tailwind).
- Financial actions communicate impact before execution (what changes, in which account/currency, and why).
- The product nudges understanding and healthier habits without shaming or gamifying sensitive finances.

## Scope Guardrails (MVP Bias)
- Prefer simple, composable primitives (accounts, transactions, transfers, recurring rules, categories, basic reports).
- Avoid premature complexity: no caching/aggregate tables unless needed; compute reports on-demand.
- “Nice to have” features (budgets, alerts, advanced analytics) must not compromise correctness or traceability.

## Development Workflow and Quality Gates
- Start from a PRD; keep acceptance criteria testable; update PRDs when scope changes.
- Introduce/adjust ADRs for architectural decisions; do not “sneak” new patterns without documentation.
- Add tests where risk is highest: tenant isolation, currency rules, idempotency, atomicity, and audit emission.
- Keep domain logic in the API (NestJS); Web (Next.js) stays a client/BFF (auth flows, UI, minimal server glue).

## Governance
- This constitution supersedes local conventions when there is a conflict.
- Amendments require:
  1) a documented rationale (PRD/ADR reference),
  2) an implementation plan,
  3) migration/compatibility notes when behavior or contracts change.

**Version**: 1.0.0 | **Ratified**: 2026-01-01 | **Last Amended**: 2026-01-01
