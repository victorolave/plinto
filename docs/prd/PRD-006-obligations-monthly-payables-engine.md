# PRD 006: Obligations (monthly payables engine)

## Status
Implemented

## Objective

Let a tenant see **what must happen this month**, not only what already
happened. A recurring rule describes an intent ("rent, 2,300,000, monthly"); an
**obligation instance** is that intent materialized for a specific period, with
a due date and a settlement state.

Upon completion of this PRD, a user must be able to:
- see the obligations of a period, each with its status
- record a one-off obligation with no template behind it
- declare that a transaction settled an obligation
- read the period totals: expected, paid, outstanding
- project future months

---

## Problem

PRD 002–005 record what already moved. The spreadsheet Plinto replaces does
something the system could not: it holds a **monthly block of payables with
state** — the TOTAL / TOTAL PAID / OUTSTANDING rows that answer "do we make it
to the end of the month?".

Without it:
- a rule that has not executed yet is invisible
- nothing distinguishes "paid" from "not due yet" from "late"
- there is no forward projection, so the household plans blind

---

## Users

- **Owner / Member** of a tenant, who can record and reconcile obligations.
- **Viewer**, who can see what the household owes but cannot declare a bill
  settled.
- The user already has a tenant (PRD 001), accounts and transactions
  (PRD 002/003) and, for generated obligations, recurring rules (PRD 004).

---

## Scope (In Scope)

### 1. Obligation instance

| Field | Notes |
| --- | --- |
| `sourceType` | `recurring_rule` \| `manual` |
| `recurringRuleId` | set if and only if `sourceType = recurring_rule` |
| `period` | `YYYY-MM`, the same format the recurring executor already uses |
| `dueDate` | must fall inside `period` |
| `name` | snapshotted from the rule, or given for a one-off |
| `expectedAmountMinor` | snapshot — see *Snapshots* below |
| `currency` | inherited from the rule's account |

Every query is scoped by `tenant_id`.

A `CHECK` constraint keeps `source_type` and the populated foreign key in
agreement, so an instance can never claim an origin it does not reference.
PRD-007 extends the enum, the column set and that constraint when debt
schedules arrive.

### 2. Status is derived, never stored

There is **no status column**. The table stores facts — expected amount, due
date, payments — and the state is a projection over them:

| State | Condition |
| --- | --- |
| `paid` | settled amount >= expected amount |
| `overdue` | not settled and the due date has passed |
| `partial` | something settled, not yet enough, not yet due |
| `pending` | nothing settled, not yet due |

Precedence is `paid` > `overdue` > `partial` > `pending`. `paid` wins so a
late-but-settled obligation is never flagged overdue. `overdue` wins over
`partial` because a half-paid bill that is already late is a late bill — the
urgency is what the household needs to see, and the partial payment stays
visible in `paidAmountMinor`.

A stored status could contradict the payments backing it, and would need a job
to age instances into `overdue`, leaving them stale between runs.

### 3. Generation

`POST /api/internal/obligations/generate` materializes one instance per active
rule, for each period in the horizon. It runs as a system operation (ADR 0006),
across tenants, guarded by the internal key.

- **Idempotent by (rule, period)**, enforced by a unique index. Re-running a
  period never duplicates an obligation, whether the duplicate was visible to
  the pre-check or created by a concurrent run in between.
- **`horizonMonths`** (1–12) materializes future periods; that forward
  projection is what produces the spreadsheet's future months.
- Paused and archived rules are never materialized (PRD-004 lifecycle).
- Rules on archived accounts are excluded.

Generation records **no audit events**: an instance is a derived projection
that carries no money and is reproducible from its rule.

### 4. One-off obligations

`POST /api/obligations` records an obligation with no template — a tax filing,
a school enrolment. Always stored as `manual`; the source type is not
caller-controlled. The due date must fall inside the declared period, otherwise
the obligation would be invisible in the month reporting it.

### 5. Reconciliation

`POST /api/obligations/{id}/payments` declares that an existing transaction
settles (part of) an obligation.

| Rejected when | Status | Reason |
| --- | --- | --- |
| Obligation or transaction in another tenant | 404 | Tenant isolation |
| The transaction is income | 409 | Linking a credit would report the household as having paid a bill it was actually paid for |
| Currencies differ | 409 | Period totals would add incomparable units; conversion is PRD-008 |
| The transaction already settles something | 409 | One transaction, one obligation |

The last rule is checked in the service for a useful message **and** enforced by
a global unique index on `transaction_id`, so a concurrent caller cannot slip
past the check.

`DELETE /api/obligations/{id}/payments/{transactionId}` undoes the link,
freeing the transaction. The transaction itself is never modified.

Reconciliation and one-off creation **are** audited: unlike generation, these
are decisions a person made about which money paid which obligation.

### 6. Partial payments

An obligation may be settled by **several** transactions — rent paid in two
transfers. Payments live in their own table rather than as a nullable column,
because a single-transaction model has nowhere to put the second transfer, and
migrating later would mean moving data and rewriting the state derivation.

### 7. Period totals

`GET /api/obligations/summary` returns **one set of totals per currency** — a
household can owe in more than one, and adding them together would be
arithmetic on incomparable units.

The outstanding total is the **sum of each obligation's own shortfall**, not
expected minus paid. Those diverge as soon as anything is overpaid:

| Obligation | Expected | Paid |
| --- | ---: | ---: |
| Rent | 230,000 | 250,000 |
| Utilities | 100,000 | 0 |
| **Total** | **330,000** | **250,000** |

Still owed: **100,000**. Subtracting the totals reports **80,000** — the
overpayment absorbs part of another obligation's shortfall. Overpayment is
ordinary (a rounded transfer, a late fee, rent paid together with the building
fee) and the error always understates what the household owes, which is exactly
the number this feature exists to get right.

That figure needs payments grouped per instance before the currency grouping,
which Prisma's `groupBy` cannot nest — so this is the only aggregate in the
codebase written as `$queryRaw`. Aggregation still happens entirely in
Postgres.

---

## Snapshots

`expectedAmountMinor` and `name` are copied from the rule **at generation
time**. Editing the rule afterwards does not rewrite what an
already-materialized period was told to expect, and re-running generation skips
existing instances rather than updating them.

This is right for closed periods — history must not be rewritten — and
deliberately conservative for future ones: raising the rent today leaves next
quarter's already-generated instances on the old amount until they are removed
and regenerated.

> **Open question for a later slice.** Whether regenerating should refresh
> *unpaid future* instances is a product decision, not a technical one. It is
> recorded here rather than silently resolved.

---

## Out of Scope

- Currency conversion when reconciling (PRD-008)
- Editing or deleting an obligation instance after creation
- Obligations from debt schedules (PRD-007)
- Notifications and reminders
- Bulk reconciliation

---

## Main Flow (Happy Path)

1. The scheduler calls the generation endpoint for the period.
2. Each active rule materializes its obligation, due on the rule's day.
3. The household opens the board and sees what is owed, and the outstanding
   total.
4. Rent is paid; the transaction is recorded (manually or by the recurring
   executor).
5. The user links that transaction to the obligation.
6. The obligation reads `paid`; the outstanding total drops.

---

## Acceptance Criteria

- [x] Instances are generated from active rules for a period.
- [x] Re-running generation for a period creates no duplicates.
- [x] Future periods can be generated for projection.
- [x] Paused and archived rules are never materialized.
- [x] One-off obligations can be recorded without a rule.
- [x] A transaction can be linked to an obligation and unlinked again.
- [x] A transaction cannot settle two obligations.
- [x] Income and mismatched currencies are rejected.
- [x] An obligation can be settled by several transactions.
- [x] Period totals report expected, paid and outstanding per currency.
- [x] The outstanding total stays correct when an obligation is overpaid.
- [x] Every reconciliation is audited with actor and correlation id.

---

## Success Metrics

- The household stops consulting the spreadsheet to know what is left to pay.
- The outstanding figure matches what the family would compute by hand.
- Future months are visible before they arrive.

---

## Technical Notes

- Generation via background jobs (ADR 0006).
- Persistence and multi-currency per ADR 0004.
- Authorization per ADR 0007: `obligation:read` / `obligation:write`. A viewer
  reads but cannot reconcile.
- Audit per ADR 0008: `obligation.created`, `obligation.reconciled`,
  `obligation.payment_removed`.

### Endpoints

| Method | Path | Permission |
| --- | --- | --- |
| `GET` | `/api/obligations?period=YYYY-MM` | `obligation:read` |
| `GET` | `/api/obligations/summary?period=YYYY-MM` | `obligation:read` |
| `POST` | `/api/obligations` | `obligation:write` |
| `POST` | `/api/obligations/{id}/payments` | `obligation:write` |
| `DELETE` | `/api/obligations/{id}/payments/{transactionId}` | `obligation:write` |
| `POST` | `/api/internal/obligations/generate` | internal key |

Both read endpoints default to the current period.

### Forward compatibility

- **PRD-007 (debts)** adds `debt_schedule` to `ObligationSourceType`, a nullable
  `debt_id` foreign key, and extends the CHECK constraint. No existing column
  changes.
- **PRD-008 (multi-currency)** is where cross-currency reconciliation belongs;
  until then a currency mismatch is rejected rather than silently converted.
- **PRD-009 (reports)** consumes the period summary as-is; it is already
  grouped by currency.
