# PRD 004: Recurring transactions (automatic expenses and income)

## Status
Draft (Ready for implementation)

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
- `active` (boolean)

Rules:
- currency must match the account
- no transactions are created when the rule is created

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

---

## Out of Scope

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

- Inactive rule -> not executed.
- Missing account or account from another tenant -> error.
- Inconsistent currency -> validation failed.
- Duplicate execution -> ignored due to idempotency.

---

## Acceptance Criteria

- [ ] Recurring rules can be created.
- [ ] No transactions are created when creating the rule.
- [ ] Transactions are created automatically on the correct date.
- [ ] No duplicates exist across retries.
- [ ] All executions are audited.
- [ ] The system keeps working if a job fails and is retried.

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
- The API only creates rules; jobs create transactions.
