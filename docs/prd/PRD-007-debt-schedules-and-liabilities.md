# PRD 007: Debt schedules and liabilities

## Status
Draft

## Objective

Let a tenant record what it **owes**, not only what it pays each month. A
recurring rule describes a repeating cost; a **debt** describes a balance that
shrinks as it is paid, and the installments it produces along the way.

Upon completion of this PRD, a user must be able to:
- record a loan received, so the cash arrives **and** the liability appears
- record a purchase financed in fixed installments, with its plan
- see each period's installments alongside the household's other obligations
- see how much the household owes in total, apart from what it holds

---

## Problem

PRD 002–006 model money the household **has** and costs it **repeats**. They
have no way to say that money arriving is owed back, or that a cost ends after
six payments.

The spreadsheet Plinto replaces says both, by hand:

- Its income sheets carry two columns side by side, `INGRESO` and `PRESTAMOS`,
  maintained separately by a person who understood that a loan is not income.
  In one month those read 16,169,307 against 983,000.
- A whole sheet, `ADDI`, is an amortization table kept manually: 44 financed
  purchases across `VALOR REAL`, `VALOR CREDITO`, `TOTAL INTERES`,
  `VALOR CUOTAS`, `NO. CUOTAS`, `CUOTAS PAGADAS`, `PENDIENTE`.

In the payables block for January 2026, **18,757,030 of 23,375,030 COP is debt**
— roughly four fifths of what the household pays in a month.

Without this PRD:
- a loan recorded as income inflates what the household appears to earn, and
  every report built on it is wrong
- a purchase in three installments is a recurring rule somebody must remember to
  pause, and forgetting means an obligation that never ends
- the household can see this month's payments but never the balance behind them,
  which is the number that decides whether the situation is improving

---

## Users

- **Owner / Member** of a tenant, who can record debts and settle installments.
- **Viewer**, who can see what the household owes but cannot record or settle.
- The user already has a tenant (PRD 001), accounts and transfers (PRD 002/003)
  and the obligations engine (PRD 006), which this PRD extends rather than
  duplicates.

---

## Scope (In Scope)

### 1. Liability accounts

`AccountType` gains `debt`. A liability account is an ordinary account whose
balance is normally negative: it is what the household owes that lender.

Nothing about balances needs to change to allow this. A balance is already
`SUM(income) − SUM(expense)` per account with no floor, so an account can hold a
negative figure today.

One account per lender, not per debt. `ADDI` is one account across all 44
purchases; `Lineru` is one account across every loan taken from them.

### 2. A loan received is a transfer, not income

Recording a loan moves money **from** the liability account **to** the account
that received it. The lender's balance goes more negative by the amount owed;
the bank account goes up by the cash that arrived.

This is deliberately not a new transaction type. Cash arriving from a lender is
not income, and expressing it as a transfer says so in the model rather than in
a comment — the household's income figure never sees it.

| Requirement | |
| --- | --- |
| The interface offers "record a loan", not "make a transfer" | the mechanism is an implementation detail, not a thing to teach |
| Creating a lender account is part of that flow | nobody should have to prepare an account before recording the loan |
| Repaying a loan is the reverse transfer | bank → lender, balance moves toward zero |

Any income reporting added later must exclude transfer legs. Loan disbursements
are the case that makes this non-optional rather than tidy.

### 3. Debt schedule

A **debt schedule** is a fixed plan of installments against a liability account.
It is what the `ADDI` sheet holds per row.

| Field | Notes |
| --- | --- |
| `accountId` | the liability account it pays down |
| `name` | what was bought, or what the loan was for |
| `principalMinor` | `VALOR CREDITO` — the total to be repaid, interest included |
| `installmentMinor` | `VALOR CUOTAS` |
| `installmentCount` | `NO. CUOTAS` |
| `firstDueDate` | when the first installment falls |
| `currency` | inherited from the account |
| `status` | `active` \| `settled` \| `cancelled` |

`principalMinor` is what will be repaid in total, not what the goods cost. The
difference between the two is interest, and it is **recorded, not calculated**
— see *Decisions*.

Installments are equal. A final installment that differs by rounding is
absorbed by the last one, so the schedule always sums exactly to the principal.

Outstanding balance is **derived**, never stored: principal minus what its
obligations have been paid. Same reasoning as PRD-006's status — a stored
balance can contradict the payments behind it, and then a person has to decide
which of the two to believe.

### 4. Installments become obligations

`ObligationSourceType` gains `debt_schedule`, alongside a nullable
`debtScheduleId` and the extended `CHECK` constraint PRD-006 already promised.
No existing column changes.

Generation materializes an obligation for each installment whose period falls in
the window being generated, exactly as it does for recurring rules, and with the
same idempotency: one obligation per (schedule, period).

An installment obligation carries the schedule's `installmentMinor` as its
expected amount and a name that says which installment it is, so a person
reading the month's board can tell "ADDI — 3 of 6" from a rent that repeats
forever.

Generation stops at `installmentCount`. This is the property a recurring rule
cannot express and the reason a financed purchase is not one.

### 5. Settling an installment

Unchanged from PRD-006: a transaction is linked to the obligation, and the
obligation's status is derived from its payments.

The debt's outstanding balance follows from the same payments, so settling an
installment reduces what the household owes without a second step to remember.

### 6. What the household owes

The period summary gains a companion: total outstanding debt per currency,
independent of the period.

Balances must present assets and liabilities apart. Netting a debt account into
the same total as a bank account changes the meaning of the figure on the
dashboard from "what we hold" to "what we are worth", silently, for a household
that never asked for the second one.

---

## Decisions

Three calls that shape the model, recorded here rather than left implicit.

### Interest is recorded, not calculated

The schedule stores what will be repaid and in how many installments. It does
not store a rate and does not amortize.

Colombian retail financing is quoted the way `ADDI` records it: a total, a
number of installments, and an installment amount. The source data has no rate
in it, and `TOTAL INTERES` is a subtraction — `VALOR CREDITO − VALOR REAL` —
not an input.

Computing French amortization would invent precision the household does not
have, and would disagree with the lender's own numbers the first time rounding
differed.

> **Alternative rejected.** Storing an annual rate and deriving installments.
> Correct for a mortgage, wrong for every row of the sheet this replaces.

### Revolving credit is out of scope

Credit cards are a different model: a limit, a statement cycle, a minimum
payment, and a balance that grows with use rather than shrinking on a schedule.

They belong in a later PRD. `AccountType.credit` already exists, so a card can
be held today as an account with a negative balance — partial, and not made
worse by waiting.

> **Alternative rejected.** Covering both here. Roughly doubles the work and
> couples two models that share a word and little else.

### A debt is an account plus a schedule, not one new entity

The liability lives as an account so that balances, transactions, transfers and
the ledger all work on it unchanged. The plan lives as a separate schedule
because installment counts and due dates are not account properties.

> **Alternative rejected.** A single `Debt` entity holding both balance and
> plan. It would need its own balance arithmetic, its own transaction linkage
> and its own ledger view — three things that already exist and work.

---

## Out of Scope

- Revolving credit: limits, statement cycles, minimum payments
- Interest rates, APR, amortization from a rate
- Early settlement and its interest rebate
- Refinancing or consolidating existing debts
- Late fees and penalty interest
- Debt held **by** the household (money lent to somebody else)
- Importing the `ADDI` sheet (PRD-010, the spreadsheet import)

---

## Main Flow (Happy Path)

1. The household buys a fridge on six installments.
2. They record a debt schedule against the lender's account: total to repay,
   six installments, first due date.
3. Generation materializes the next months' installments as obligations, six of
   them and no more.
4. The month's board shows the installment beside rent and utilities.
5. They pay it; the transaction is linked to the obligation.
6. The obligation reads `paid`, the outstanding total for the month drops, and
   the debt's remaining balance drops by the same amount.
7. After the sixth, the schedule reads `settled` and generates nothing further.

---

## Acceptance Criteria

- [ ] A liability account can be created and holds a negative balance.
- [ ] A loan received increases the receiving account and the amount owed, and
      never appears as income.
- [ ] A debt schedule can be recorded with principal, installment and count.
- [ ] Installments sum exactly to the principal, rounding included.
- [ ] Generation materializes one obligation per installment period.
- [ ] Re-running generation for a period creates no duplicates.
- [ ] Generation never produces more obligations than `installmentCount`.
- [ ] A settled schedule generates nothing further.
- [ ] Paying an installment reduces the debt's outstanding balance.
- [ ] Outstanding debt is reported per currency, apart from asset balances.
- [ ] A viewer can see debts and cannot record or settle one.
- [ ] Every debt write is audited with actor and correlation id.

---

## Success Metrics

- The household stops maintaining the `ADDI` sheet by hand.
- The `PRESTAMOS` column disappears, because the distinction lives in the model.
- The total owed is visible without adding up a month's payables.
- A financed purchase ends on its own, with nobody remembering to stop it.

---

## Technical Notes

- Persistence and multi-currency per ADR 0004, at the currency's real minor
  unit — a COP installment carries no centavos.
- Generation via the same background job as PRD-006 (ADR 0006). One scheduler
  call materializes both rule-based and installment obligations.
- Authorization per ADR 0007: `debt:read` / `debt:write`, granted on the same
  lines as `obligation:*` — a viewer reads, an owner and a member write.
- The `CHECK` constraint on `obligation_instances` is extended, not replaced.
  Prisma does not model CHECK constraints, so it lives in the migration only.

### Endpoints

| Method | Path | Permission |
| --- | --- | --- |
| `GET` | `/api/debts` | `debt:read` |
| `POST` | `/api/debts` | `debt:write` |
| `PATCH` | `/api/debts/{id}` | `debt:write` |
| `POST` | `/api/debts/{id}/cancel` | `debt:write` |
| `GET` | `/api/debts/summary` | `debt:read` |
| `POST` | `/api/loans` | `debt:write` |

`POST /api/loans` records a loan received. It is a distinct route rather than a
transfer because the household is doing a distinct thing, and the interface
should not ask them to know otherwise.

### Delivery

Three vertical slices, in order:

| Slice | Outcome |
| --- | --- |
| 7.1 | Record a loan received: cash arrives, liability appears |
| 7.2 | Record a financed purchase and see its installments as obligations |
| 7.3 | See total household debt, apart from what it holds |

7.2 is the largest and is where `debt_schedule` enters `ObligationSourceType`.

### Forward compatibility

- **Revolving credit** adds a separate schedule shape; nothing here changes.
- **PRD-010 (spreadsheet import)** loads the `ADDI` sheet into debt schedules.
  It depends on this PRD, and on amounts already being stored at the currency's
  real minor unit — importing before either would load four fifths of seven
  years of history with the wrong shape and the wrong scale.
