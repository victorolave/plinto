# PRD 003: Transfers between accounts and basic FX support

## Status
Implemented (transfers between accounts, including across currencies, shipped;
a consolidated multi-currency figure is out of scope — see the
[roadmap](../roadmap.md#4-consolidated-multi-currency-view))

## Objective

Allow a tenant to move money between accounts, including transfers between
**different currencies**, preserving financial integrity, traceability, and
auditability.

Upon completion of this PRD, a user must be able to:
- transfer money between accounts within the same tenant
- transfer money between accounts in different currencies (e.g. COP -> USD)
- clearly understand what happened in each account

---

## Problem

In real life, families:
- move money between accounts
- convert income across currencies
- need to understand the real impact of those operations

Without an explicit transfer model:
- confusing manual expenses/income are created
- traceability is lost
- balances stop making sense

---

## Users

- **Owner / Member** of a tenant.
- The user already has:
  - an active tenant (PRD 001)
  - accounts created (PRD 002)

---

## Scope (In Scope)

### 1. Transfers between accounts (same currency)

A user can transfer money between two accounts of the same tenant and same currency.

Model:
- **two transactions** are created:
  - debit in source account
  - credit in destination account
- both linked by `transfer_id`

Rules:
- both transactions are created **atomically**
- net balance per currency does not change
- both transactions are audited

---

### 2. Transfers between accounts (different currency - FX)

A user can transfer money between accounts of different currencies (e.g. COP -> USD).

Model:
- two transactions linked by `transfer_id`
- different currencies
- explicit FX metadata:
  - `fx_rate`
  - `source_currency`
  - `target_currency`
  - `fee_minor` (optional)
  - `rate_source` (manual)

Rules:
- **no implicit conversion**
- the rate used must be explicit
- source and target amounts are entered consciously

---

### 3. Execution as a financial operation

Transfers:
- are **critical financial operations**
- are **transactional** — both legs are written inside one database
  transaction, or neither is
- are **auditable**

> **Amended 2026-09-10, and this one was a false guarantee, not a stale
> sentence.** This section used to say transfers were executed via background
> jobs, that the HTTP request "only validates and enqueues", and that
> duplicates were avoided by idempotency. None of that is what the code does.
>
> A transfer runs **synchronously inside the request**, in a single Prisma
> transaction. There is no queue. And `CreateTransferSchema` has no
> `idempotencyKey` field, so **a double submission creates two transfers**.
> The `idempotencyKey` that exists elsewhere belongs to stored transactions and
> recurring rules, not to this endpoint.
>
> Synchronous execution is a defensible choice — the operation is short, and a
> caller who gets a 200 knows the money moved. The idempotency claim is not
> defensible, because someone reading this document would have believed a
> retry was safe. Closing that gap is tracked in the
> [roadmap](../roadmap.md#6-idempotent-transfers).

---

### 4. Visualization

The system must show:
- transfers as normal transactions in each account
- cross-reference (source/destination)
- FX metadata when applicable

No special "transfers" view is introduced.

---

## Out of Scope

- Automatic rates from external providers
- Automatic historical conversion
- Bank reconciliation
- Advanced FX reports

---

## Main Flow (Happy Path)

1. User selects the source account.
2. User selects the destination account.
3. Enters amount(s) and FX rate if applicable.
4. Confirms the transfer.
5. The system writes both legs inside one database transaction, during the
   request.
6. Both accounts reflect the transfer.

---

## Errors and validations

- Accounts must belong to the same tenant.
- Inconsistent currencies are not allowed without explicit FX.
- Insufficient funds (if validated).
- Duplicates are **not** currently prevented: a repeated submission creates a
  second transfer. See §3 and the
  [roadmap](../roadmap.md#6-idempotent-transfers).

---

## Acceptance Criteria

- [ ] Transfers between accounts of the same tenant are supported.
- [ ] Transfers between accounts in different currencies are supported.
- [ ] Transfers create exactly two transactions.
- [ ] Currencies are not mixed incorrectly.
- [ ] Transfers are idempotent. **Not met** — see §3.
- [ ] Operations are audited.
- [ ] No partial states exist.

---

## Success Metrics

- Users can move money between currencies without Excel.
- Zero balance inconsistencies.
- Full clarity in financial history.

---

## Technical Notes

- Persistence and currency per ADR 0004.
- ~~Financial jobs per ADR 0006.~~ Transfers do not use the job runner; they
  execute in-request. ADR 0006 governs the obligations engine and recurring
  rules.
- Audit per ADR 0008.
- Authorization per ADR 0007.
