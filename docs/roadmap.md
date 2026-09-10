# Roadmap

What Plinto does not do yet, why it was left out, and roughly when it lands.

Everything on this page is deliberately absent from `v0.1.0`. Nothing here is
a defect: each item was weighed and postponed, and the reason is written down
so the decision can be argued with instead of guessed at.

For what `v0.1.0` **does** deliver, see the [README](../README.md). For what a
version number promises, see [versioning](versioning.md).

---

## 1. Importing data back in

**Status:** planned, next after `v0.1.0`

You can export a household as JSON and the ledger as CSV, from **Settings**,
with no support ticket. You cannot feed either of them back in.

That makes the promise half-kept. "Your data is yours" is true in the direction
that matters most — you can leave, and nothing holds your records hostage — but
today the only way to restore what you exported is `deploy/restore.sh`, which
works at the PostgreSQL level and restores a whole database, not a household.
That is a self-hoster's tool, not a person's.

**What lands:** an import that reads the JSON produced by
`GET /api/export/household`, validates it against the same contract that wrote
it, and reports what it would change before changing anything. Restoring one
household into a running instance must not disturb the others.

**Why it waited:** import is where a bad decision becomes permanent. Reading a
file that claims to be a household and writing it into a live database touches
every module at once, and the failure mode is silent duplication or a partial
write nobody notices until the totals stop adding up. It deserves its own
design pass, not a corner of the launch.

---

## 2. Revolving debt in the debt summary

**Status:** specified, small, blocked on a design decision

[PRD-011](prd/PRD-011-revolving-credit-and-card-statements.md) §6 says the debt
summary carries **three** figures per currency, drawn from three different
sources and reported apart because a single headline would be a number nobody
could defend:

| Figure | Source | Today |
|--------|--------|-------|
| `scheduledOutstandingMinor` | Debt schedules | ✅ delivered |
| `lenderOwedMinor` | Liability accounts | ✅ delivered |
| `revolvingOwedMinor` | Latest statement per active credit line | ❌ missing |

The number itself is not missing from the product — the credit board totals
revolving debt on its own. It is missing from the one place §6 says it belongs,
beside the other two.

**Why it waited:** it makes `DebtsModule` depend on `CreditModule`. That
coupling is defensible, but it is a structural decision and it deserves its own
commit and its own argument, rather than riding along inside a UI slice.

---

## 3. Reports beyond spending by category

**Status:** not specified — PRD-009 is a name, not a document

`GET /api/reports/expenses-by-category` is the only report that exists. There
is no month-over-month view, no comparison between periods, and nothing broken
down by account.

**Why it waited:** reporting is easy to build badly and expensive to change
once people rely on the shapes. The honest prerequisite is a few months of a
real household using the ledger, so the reports answer questions somebody
actually asked.

---

## 4. Consolidated multi-currency view

**Status:** not specified — PRD-008 is a name, not a document

Every account carries its own currency and obligations report one row per
currency, which is the correct default: adding two currencies into one figure
requires a rate, and a rate requires a date and a source. Plinto does not have
those yet, so it does not pretend.

The consequence is that a household holding COP and USD has no single "what do
I have" number, only two correct ones.

**Why it waited:** the missing piece is not arithmetic, it is provenance. A
consolidated figure is only as trustworthy as the rate behind it, and storing
rates means deciding where they come from, how often they refresh, and what
happens to historical figures when they move. Until that is decided, two
honest numbers beat one invented one.

---

## 5. Structured logs with correlation

**Status:** specified in [ADR 0008](adr/0008-observability-audit-logs-traceability.md), half built

The audit trail works: `AuditEvent` records who changed what, when, and under
which correlation id. What does not work is following one operation through the
logs while it happens. The API uses Nest's default text logger, and the
`request_id` that reaches the response header never reaches a log line.

For someone running this on their own server, the difference shows up on the
worst day: you can reconstruct what happened afterwards from the audit table,
but you cannot filter a log stream by request and watch it fail.

**What lands:** JSON log output with `request_id` on every line of a request
and `job_id` on every line of a scheduled job, as ADR 0008 already describes.

---

## Not on this roadmap

**Billing and subscriptions.** Community is self-hosted and free, under
AGPL-3.0. There is nothing to charge for and no payment code in the repository.
A hosted offering, if it happens, is a separate product and does not change
what Community delivers.
