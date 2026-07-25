# PRD 004: Recurring transactions (automatic expenses and income)

## Status
Implemented (rule lifecycle complete; execution runs via the internal endpoint)

## Objective

Allow a tenant to automate the creation of recurring expenses and income
(e.g. rent, utilities, salary), ensuring that:
- they are created **only once per period**
- no duplicates exist
- traceability and auditability are preserved

Upon completion of this PRD, a user must be able to:
- define a recurring rule
- let the system create transactions automatically
- understand when and how they were executed

---

## Problem

Many financial movements are repetitive:
- monthly payments
- periodic income
- bills with fixed dates

Without automation:
- users forget to record them
- balances become distorted
- the system loses value compared to a spreadsheet with reminders

---

## Users

- **Owner / Member** of a tenant.
- The user already has:
  - an active tenant (PRD 001)
  - accounts created (PRD 002)

---

## Scope (In Scope)

### 1. Recurring rules

A user can create a **recurring rule** that describes which transaction must be
created and when.

Minimum fields:
- `name`
- `account_id`
- `type` (`income` | `expense`)
- `amount_minor`
- `currency` (inherited from the account)
- `frequency` (monthly initially)
- `day_of_month` (1–28)
- `start_date`
- `status` (`active` | `paused` | `archived`)

Rules:
- currency must match the account
- no transactions are created when the rule is created

---

### 1b. Rule lifecycle

A rule sits in exactly one state. This replaced an earlier `active` boolean,
which could not express "retired" without a second flag — and a boolean pair
would have made the contradictory "active and archived" combination
representable.

| State | Posted by the job | Editable | How it is reached |
| --- | --- | --- | --- |
| `active` | yes | yes | created, or resumed from `paused` |
| `paused` | no | yes | paused, restored from `archived`, or created paused |
| `archived` | no | no | archived from `active` or `paused` |

Transitions:
- **pause** / **resume** move a rule between `active` and `paused`.
- **archive** retires a rule from either live state.
- **restore** returns an archived rule to `paused` — never straight to
  `active`. Restoring means "take this out of the archive"; coming back active
  could post money on the next job run with nobody having decided that it
  should. Resuming stays a separate, deliberate act.
- editing, pausing or resuming an archived rule is rejected with `409`
  (`RECURRING_RULE_ARCHIVED`), so the archive has exactly one exit.
- a transition into the state a rule already holds is an idempotent success and
  records no audit event.

Rules are **archived, never deleted**. Executions reference the rule with
`ON DELETE RESTRICT`, so deleting an executed rule fails at the database, and
`transactions.recurring_rule_id` is `ON DELETE SET NULL`, which would strand
the audit trail required by ADR 0008.

Editable fields are `name`, `amount_minor`, `day_of_month` and `start_date`.
The account, type, currency and frequency are frozen: past periods are already
materialized as transactions carrying those values, so changing them would
leave the rule contradicting its own history. Retire the rule and create a new
one instead.

Archived rules are hidden from listings unless `?includeArchived=true` is
requested, matching how archived accounts behave.

---

### 2. Automatic execution

- The system periodically evaluates active rules.
- When due, it **creates the transaction for the period**.
- Execution runs as a **background financial operation**.

Guarantees:
- idempotency by (rule, period)
- transactional execution
- no partial states

---

### 3. Idempotency and duplicates

- Each execution has a deterministic key:
  - `recurring:{rule_id}:{YYYY-MM}`
- Before creating a transaction, the system checks whether a transaction created
  by that rule and period already exists.
- Retries do not produce duplicates.

---

### 4. Audit and traceability

Each automatic execution:
- generates an audit event
- indicates:
  - actor: `system`
  - source: `job`
  - reference to the recurring rule

Transactions created:
- include source metadata (`source = recurring`)

---

### 5. Visualization

- Recurring transactions are shown as normal transactions.
- The UI indicates they were created automatically.
- The user can edit or delete the created transaction
  (it is a financial operation).
- Rules live in the recurring section of the transactions view, where each row
  offers the transition that applies to its current state (Pause for an active
  rule, Resume for a paused one) plus Edit and Archive. Archived rules are
  folded behind a "Show archived" toggle with a Restore action.

---

## Out of Scope

- Bulk lifecycle actions across many rules at once
- Advanced frequencies (weekly, biweekly)
- Rules spanning multiple accounts
- Automatic pause due to insufficient funds
- Pre-payment notifications
- Bulk editing of rules

---

## Main Flow (Happy Path)

1. User creates a recurring rule.
2. The system stores the rule.
3. On the corresponding date:
   - execution is enqueued.
4. The system creates the transaction for the period.
5. The transaction appears in the account.

---

## Errors and validations

- Non-`active` rule (paused or archived) -> not executed.
- Missing account or account from another tenant -> error.
- Inconsistent currency -> validation failed.
- Duplicate execution -> ignored due to idempotency.

---

## Acceptance Criteria

- [x] Recurring rules can be created.
- [x] No transactions are created when creating the rule.
- [x] Transactions are created automatically on the correct date.
- [x] No duplicates exist across retries.
- [x] All executions are audited.
- [x] The system keeps working if a job fails and is retried.
- [x] Rules can be edited, paused, resumed, archived and restored.
- [x] Paused and archived rules are never executed.
- [x] Every rule mutation is audited with actor and correlation id.

---

## Success Metrics

- Users stop manually recording fixed expenses.
- Zero duplicated transactions.
- Trust in automation.

---

## Technical Notes

- Execution via background jobs (ADR 0006).
- Persistence per ADR 0004.
- Authorization per ADR 0007.
- Audit per ADR 0008.
- The API only manages rules; jobs create transactions.

### Endpoints

| Method | Path | Permission |
| --- | --- | --- |
| `GET` | `/api/recurring-transactions?includeArchived=` | `transaction:read` |
| `POST` | `/api/recurring-transactions` | `transaction:write` |
| `PATCH` | `/api/recurring-transactions/{id}` | `transaction:write` |
| `POST` | `/api/recurring-transactions/{id}/pause` | `transaction:write` |
| `POST` | `/api/recurring-transactions/{id}/resume` | `transaction:write` |
| `POST` | `/api/recurring-transactions/{id}/restore` | `transaction:write` |
| `DELETE` | `/api/recurring-transactions/{id}` (archives) | `transaction:write` |
| `POST` | `/api/internal/recurring/execute` | internal key |

All rule mutations share `transaction:write` rather than a dedicated delete
permission: retiring a template moves no money and destroys no record, so it
belongs to the same class of act as editing one.

### Audit actions

`recurring_rule.created`, `.updated`, `.paused`, `.resumed`, `.archived`,
`.restored` — resource type `recurring_rule`, carrying actor and correlation
id, with `before`/`after` metadata on updates and transitions.
