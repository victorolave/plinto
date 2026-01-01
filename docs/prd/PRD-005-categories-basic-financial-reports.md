# PRD 005: Categories and basic financial reports

## Status
Draft (Ready for implementation)

## Objective

Allow a tenant to classify their transactions and get a basic but clear view of
their finances, answering questions such as:

- What am I spending my money on?
- How much do I spend per month?
- How are my expenses distributed by category?
- How are my income vs expenses evolving over time?

Upon completion of this PRD, Plinto must provide **visibility**, not advanced analysis.

---

## Problem

Recording transactions without classification limits financial understanding.
Families need to:
- group expenses
- see totals by type
- compare periods

Without going into complex reporting that introduces over-engineering.

---

## Users

- **Owner / Member** of a tenant.
- The user already has:
  - an active tenant (PRD 001)
  - accounts and transactions (PRD 002)
  - transfers and recurring transactions (PRD 003 and 004)

---

## Scope (In Scope)

### 1. Categories

A tenant can define **custom categories** to classify transactions.

Minimum fields:
- `name`
- `type` (`income` | `expense`)
- `color` (optional, UI)
- `created_at`

Rules:
- categories are isolated by `tenant_id`
- a category has a single type (income or expense)
- categories are not global

---

### 2. Assigning a category to transactions

- A transaction can have **zero or one category**.
- It can be:
  - assigned when creating the transaction
  - edited later

Rules:
- the category type must match the transaction type
- changing a category does **not** change the amount (not a critical financial operation)

---

### 3. Basic reports

Reports are supported as **derived** calculations (not source of truth):

#### a) Expenses by category (by period)
- Total expenses grouped by category
- Filter by date range
- Results separated by currency

#### b) Income vs expenses (by period)
- Total income
- Total expenses
- Simple comparison (no projections)

#### c) Monthly evolution
- Totals per month
- Separated by currency
- No FX conversion

---

### 4. Multi-currency in reports

- Reports show results **per currency**.
- Currencies are not mixed.
- No automatic conversion in this PRD.

---

### 5. Performance and consistency

- Reports are computed **on-demand**.
- No aggregate tables or caching are introduced.
- Eventual consistency is acceptable:
  - a newly created transaction may briefly take time to appear.

---

## Out of Scope

- Budgets
- Overspending alerts
- Hierarchical categories
- Subcategories
- Exportable reports (CSV/PDF)
- Advanced dashboards
- Cross-tenant comparisons

---

## Main Flow (Happy Path)

1. User creates categories (e.g. "Rent", "Food").
2. Assigns categories to transactions.
3. Accesses reports.
4. Views:
   - expenses by category
   - income vs expenses
   - monthly evolution

---

## Errors and validations

- Category from another tenant -> access denied.
- Wrong category type -> validation failed.
- Invalid date range -> validation error.

---

## Acceptance Criteria

- [ ] A tenant can create and edit categories.
- [ ] Categories can be assigned to transactions.
- [ ] Reports show correct data.
- [ ] Currencies are not mixed in any report.
- [ ] A user cannot see data from another tenant.
- [ ] Reports do not modify financial data.

---

## Success Metrics

- Users better understand what they spend money on.
- Frequent use of categories.
- Reports replace basic Excel views.

---

## Technical Notes

- Persistence per ADR 0004.
- Authorization per ADR 0007.
- Audit:
  - create/edit categories (yes)
  - assign category to transaction (not critical).
- Reports are derived; they are not financial operations.
