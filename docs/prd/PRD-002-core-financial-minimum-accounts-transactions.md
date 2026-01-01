# PRD 002: Minimum financial core (accounts and transactions)

## Status
Draft (Ready for implementation)

## Objective

Enable a family/household (tenant) to record and understand their money without
spreadsheets, supporting multiple currencies correctly and safely.

Upon completion of this PRD, a tenant must be able to:
- create accounts
- record income and expenses
- view simple balances
- operate in more than one currency (e.g. COP and USD)

---

## Problem

Families often manage their finances in spreadsheets:
- duplicated data
- fragile formulas
- low traceability
- hard to maintain long-term

Plinto should offer a simple, structured, and reliable alternative that covers
basic needs without unnecessary complexity.

---

## Users

- **Owner / Member** of a tenant.
- The user is already authenticated and has an active tenant (PRD 001).

---

## Scope (In Scope)

### 1. Accounts

A tenant can create multiple financial accounts.

Each account has:
- `name`
- `type` (e.g. cash, bank, credit, savings)
- `currency` (ISO 4217, e.g. COP, USD)
- `created_at`

Rules:
- an account has **one single currency**
- currency cannot be changed once the account is created
- accounts are isolated by `tenant_id`

---

### 2. Transactions

Basic financial transactions can be recorded:

Supported types:
- `income`
- `expense`

Each transaction includes:
- `account_id`
- `amount_minor`
- `currency` (inherited from the account)
- `type`
- `description` (optional)
- `occurred_at`

Rules:
- transactions are not allowed in a currency different from the account
- amounts are stored as integers (minor units)
- every transaction belongs to a tenant

---

### 3. Listing and basic editing

- List transactions by account.
- Ordered by date (`occurred_at`).
- Basic editing allowed:
  - amount
  - description
  - date

Rules:
- editing a transaction is a **financial operation**
- it is recorded in audit logs (ADR 0008)

---

### 4. Simple balances

The system must show:
- balance per account
- total balance per currency

Rules:
- currencies are not mixed in totals
- no automatic conversion
- totals are derived calculations (not source of truth)

---

### 5. Multi-currency

- A tenant can have accounts in different currencies.
- The system shows balances separated by currency.
- No FX conversion in this PRD.

---

## Out of Scope

- Transfers between accounts
- Currency conversion (FX)
- Recurring expenses
- Categories
- Budgets
- Advanced reports
- Imports
- Notifications

---

## Main Flow (Happy Path)

1. User accesses the system with an active tenant.
2. Creates an account (e.g. "COP Bank Account").
3. Records an income.
4. Records an expense.
5. Views:
   - transaction list
   - account balance
   - total balance per currency

---

## Errors and validations

- No active tenant -> access denied.
- Wrong currency -> validation failed.
- Invalid amount -> validation error.
- Cross-tenant access -> 403.

---

## Acceptance Criteria

- [ ] A tenant can create accounts in different currencies.
- [ ] Income and expenses can be recorded.
- [ ] Balances reflect transactions correctly.
- [ ] Currencies are not mixed in totals.
- [ ] A user cannot view or modify data from another tenant.
- [ ] Financial operations are audited.
- [ ] The system works the same in SaaS and self-host.

---

## Success Metrics

- A user can record basic finances without Excel.
- Zero currency inconsistencies.
- Simple UX, understandable without a tutorial.

---

## Technical Notes

- Persistence per ADR 0004.
- Authorization per ADR 0007.
- Audit per ADR 0008.
- Do not use background jobs in this PRD (everything is synchronous).
