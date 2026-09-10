# Plinto Vertical Slice Delivery

Plinto delivers product value through **vertical slices**: small, complete increments that a user can exercise end-to-end. A slice is not “backend work”, “frontend work”, or “schema work”. A slice is a usable capability that includes contract, persistence, API, web UI, authorization, tests, documentation, and verification.

This document is the delivery guide for turning Plinto PRDs into reviewable, shippable work.

## Quick path

1. Pick the smallest user-visible outcome from a PRD.
2. Define the slice boundary using the checklist in this document.
3. Implement the full path: shared contract → API/domain/persistence → web UI → tests → docs.
4. Verify the capability with automated tests and a manual happy-path check.
5. Only then move to the next slice.

## Source of truth

| Area | Source | Rule |
| --- | --- | --- |
| Executable delivery state | Repository docs and code | The repo is the implementation source of truth. |
| Product direction | Notion | Notion may describe intent, but it must be synced into repo docs before implementation. |
| Architecture decisions | `docs/adr/` | ADRs constrain slice design. |
| Product requirements | `docs/prd/` | PRDs define product outcomes, not necessarily slice boundaries. |

If Notion and the repo disagree, **do not guess**. Verify both, update the repo-facing document, and record the decision.

## What counts as a vertical slice

A vertical slice must satisfy all of these:

- A real user can complete a meaningful task.
- The task crosses the full product path when relevant: Web → API → domain → persistence.
- Authorization and tenant isolation are handled inside the slice.
- Shared contracts are updated when request/response shapes change.
- Tests protect the behavior and at least one risk case.
- Documentation explains what is now possible and how to verify it.

## What does not count

These are horizontal layers, not slices:

| Anti-pattern | Why it is not enough |
| --- | --- |
| “Create all database tables first” | No user can do anything with tables alone. |
| “Build all API endpoints first” | No validated product flow exists without UI and verification. |
| “Design all screens first” | UI without working behavior is a prototype, not delivered functionality. |
| “Implement all repositories first” | Infrastructure is support work, not user value. |
| “Write docs saying complete” | Documentation without executed evidence is optimism, not engineering. |

This matters. Building by layers feels fast because it creates a lot of files, but it delays truth. Vertical slices force the system to prove itself early.

## Definition of Done

Every Plinto slice is done only when this checklist passes:

- [ ] User outcome is clear in one sentence.
- [ ] Scope explicitly says what is included and excluded.
- [ ] Shared Zod schemas/contracts are updated if payloads changed.
- [ ] API behavior is implemented behind the correct guards/policies.
- [ ] Persistence changes include migrations or documented schema updates.
- [ ] Web UI supports the happy path.
- [ ] Tenant isolation is enforced.
- [ ] Role/permission behavior follows ADR 0007.
- [ ] Financial operations follow ADR 0004 and ADR 0008 when applicable.
- [ ] Tests cover the happy path and at least one important failure path.
- [ ] `pnpm lint`, `pnpm test`, and `pnpm build` pass before release.
- [ ] Manual verification notes are added or updated.
- [ ] Implementation status does not claim “complete” without current evidence.

## Slice template

Use this shape when planning a new slice:

```markdown
## Slice <N>: <User-visible outcome>

### Outcome
<A user can...>

### Includes
- Shared contract:
- API/domain:
- Persistence:
- Web UI:
- Authorization:
- Tests:
- Docs:

### Excludes
- <What intentionally waits for another slice>

### Acceptance checks
- [ ] <Happy path>
- [ ] <Tenant/permission check>
- [ ] <Important business invariant>

### Verification
- [ ] pnpm lint
- [ ] pnpm test
- [ ] pnpm build
- [ ] Manual smoke check:
```

## Recommended delivery order

### Slice 0 — Close PRD 001: auth, onboarding, and tenant context

**Outcome:** A user can authenticate, complete onboarding, select a valid active tenant, and access tenant-scoped functionality with correct permissions.

Why first: every financial feature depends on a trustworthy tenant context. Do not build money features on top of questionable authorization.

Includes:

- Fix active tenant selection so any valid member can select their tenant when product intent requires it.
- Reconcile OpenAPI contract, Zod schemas, controllers, and tests.
- Run a smoke test for OIDC/onboarding.

Key evidence:

- `POST /tenants/active` is currently documented as pending review.
- ADR 0007 requires minimum necessary permissions.

### Slice 1 — Create and list financial accounts

**Outcome:** A tenant member can create accounts and see the tenant’s account list.

Includes:

- `Account` persistence model.
- Account Zod schemas.
- API endpoints to create and list accounts.
- Web UI to create/list accounts.
- Currency validation.
- Tenant isolation tests.

Excludes:

- Transactions.
- Balances.
- Transfers.

### Slice 2 — Record income/expense and view balances

**Outcome:** A tenant member can record income and expenses and see balances by account and currency.

Includes:

- `Transaction` persistence model.
- Create/list transaction endpoints.
- Account balance calculation.
- UI for recording and listing transactions.
- Audit events for financial operations.
- Currency consistency tests.

Excludes:

- Editing transactions.
- Transfers.
- Categories.

### Slice 3 — Edit transactions with audit trail

**Outcome:** A tenant member can correct a transaction while Plinto preserves traceability.

Includes:

- Transaction update behavior.
- Audit event for edits.
- UI edit flow.
- Authorization and tenant isolation tests.

Excludes:

- Bulk edits.
- Deletion policy unless explicitly decided in the slice.

### Slice 4 — Transfer between accounts in the same currency

**Outcome:** A tenant member can move money between two accounts of the same currency without changing total balance for that currency.

Includes:

- Transfer operation model or `transfer_id`.
- Atomic creation of debit and credit transactions.
- Audit events.
- UI transfer form.
- Tests proving exactly two movements and no cross-tenant account usage.

Excludes:

- FX transfers.
- External rates.

### Slice 5 — Transfer between currencies with explicit FX

**Outcome:** A tenant member can transfer between accounts in different currencies with an explicit rate and clear resulting movements.

Includes:

- FX metadata.
- Source and destination amounts.
- Explicit rate source.
- UI that makes conversion visible.
- Tests proving there is no implicit conversion.

Excludes:

- Automatic FX providers.
- Historical FX reports.

### Slice 6 — Monthly recurring transactions

**Outcome:** A tenant member can define a monthly recurring rule and the system creates the due transaction once per period.

Includes:

- Recurring rule model.
- Rule creation UI/API.
- Execution mechanism.
- Idempotency key, e.g. `recurring:{rule_id}:{YYYY-MM}`.
- Audit event with `system` actor for automatic execution.
- Retry-safe tests.

Excludes:

- Weekly/biweekly frequencies.
- Notifications.
- Bulk rule editing.

### Slice 7 — Categories and first useful report

**Outcome:** A tenant member can categorize transactions and view expenses by category for a period.

Includes:

- Category model.
- Create/edit category UI/API.
- Assign category to transaction.
- Expense-by-category report.
- Multi-currency separation.
- Tests for category type matching and tenant isolation.

Excludes:

- Budgets.
- Hierarchical categories.
- Exportable reports.

## PR and review guidance

Prefer one PR per slice. If a slice risks exceeding a comfortable review size, split it into chained PRs that still preserve product value:

1. Contract + persistence + domain behavior.
2. API + tests.
3. Web UI + manual verification.

Do this only when the review would otherwise become too large. The danger is turning “split for review” into horizontal delivery. The final chained unit must still land as one coherent capability.

## Review questions

Before opening or merging a slice, ask:

- Can a user complete the promised task?
- Can a reviewer verify it without reconstructing hidden context?
- Did we protect tenant isolation?
- Did we use the minimum necessary permission?
- Did we avoid mixing currencies incorrectly?
- Did we update the docs with evidence, not optimism?

## Related documents

- `docs/prd/PRD-001-authentication-registration-tenant-onboarding.md`
- `docs/prd/PRD-002-core-financial-minimum-accounts-transactions.md`
- `docs/prd/PRD-003-transfers-between-accounts-basic-fx-support.md`
- `docs/prd/PRD-004-recurring-transactions-automatic-expenses-income.md`
- `docs/prd/PRD-005-categories-basic-financial-reports.md`
- `docs/adr/0002-shared-contracts-zod-rest.md`
- `docs/adr/0004-persistence-multitenancy-multicurrency.md`
- `docs/adr/0007-authorization-rbac-tenant-permissions.md`
- `docs/adr/0008-observability-audit-logs-traceability.md`
