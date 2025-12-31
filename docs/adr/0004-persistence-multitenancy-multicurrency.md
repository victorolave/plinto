# ADR 0004: Persistence, Multi-Tenancy, and Multi-Currency Support

- **Status**: Accepted
- **Date**: 2025-12-30
- **Deciders**: Plinto Maintainer(s)
- **Context**: Financial data persistence for SaaS and self-host

## Context

Plinto manages sensitive financial information for multiple households/families (tenants) that share the same infrastructure in SaaS mode, as well as isolated instances in self-host mode.

The system must guarantee:

- Strict data isolation between tenants.
- Integrity and accuracy of financial data.
- Native support for **multiple currencies** (e.g., COP and USD).
- A persistence model simple to operate and migrate.
- Portability between SaaS and self-host deployments.
- Strong typing and adequate DX for a TypeScript project.

## Decision

### 1. Database Engine

**PostgreSQL** is adopted as the primary database.

Reasons:
- Robust support for transactions and referential integrity.
- Good performance in multi-tenant scenarios.
- Ease of operation both in the cloud and self-host.
- Compatibility with JSONB and complex financial schemas.

### 2. Multi-Tenancy Strategy

A strategy is adopted of:

**Single database, single schema, `tenant_id` in all business tables.**

- All persistent entities include `tenant_id`.
- Queries always filter by `tenant_id`.
- Composite indexes are created that include `tenant_id`.

This approach balances operational simplicity, scalability, and portability.

> PostgreSQL Row Level Security (RLS) is considered a future mitigation,
> but is not an initial requirement.

### 3. Data Access Layer

**Prisma** is adopted as the ORM.

- Data access is performed through a repository/service layer.
- `tenant_id` is a mandatory parameter in all read/write operations.
- No direct queries are performed without tenant context.

Prisma offers:
- Strong typing in TypeScript.
- Declarative migrations.
- Good development experience.

### 4. Migrations

- Migrations are versioned and reproducible.
- The same set of migrations is used in SaaS and self-host.
- Migrations are executed in a controlled manner in deployments.

Manual schema changes in production are not allowed.

### 5. Money Representation

Plinto uses an explicit and secure representation of monetary values:

- `amount_minor`: integer in minor units.
- `currency`: ISO 4217 code (`COP`, `USD`, etc.).

`float` or `decimal` values are not used for financial amounts.

The number of decimals per currency is defined by configuration/reference table (minor units per currency).

### 6. Currency per Account

- Each **Account** has a defined currency (`currency`).
- **Transactions** are associated with an account and inherit its currency.
- Transactions with a currency different from the account are not allowed.

This prevents incorrect currency mixing and simplifies validations.

### 7. Cross-Currency Transfers

Transfers between accounts of different currencies are modeled as:

- Two related transactions (debit and credit).
- A common `transfer_id`.
- Additional metadata:
  - `fx_rate` (rate used)
  - `fee_minor` (fee, if applicable)
  - `rate_source` (manual / provider)

This approach ensures traceability and auditability.

### 8. Base Currency per Tenant

- Each **Tenant** defines a `base_currency`.
- Aggregated reports can be converted to the base currency.
- Conversions always indicate:
  - rate used
  - effective date

The UI must show totals by currency and, when applicable, clearly labeled consolidated totals.

### 9. Exchange Rates (FX)

Exchange rates are modeled explicitly:

- `exchange_rates` table with:
  - `tenant_id`
  - `base_currency`
  - `quote_currency`
  - `rate`
  - `effective_at`
  - `source`

In the MVP:
- rates entered manually.

In the future:
- integration with external providers without changing the model.

### 10. Integrity and Auditing

- All tables include:
  - `created_at`
  - `updated_at`
- `deleted_at` (soft delete) is considered for key entities.
- Critical financial operations are executed within DB transactions.

A more detailed audit log system is considered out of initial scope.

## Consequences

### Positive
- Real support for multiple families/clients in the same infrastructure.
- Clear and consistent isolation by tenant.
- Correct and extensible handling of multiple currencies.
- Portable model for SaaS and self-host.
- Solid foundation for future reports and analysis.

### Negative / Trade-offs
- Discipline required to not omit `tenant_id` in queries.
- Higher complexity than a single-tenant model.
- Explicit FX handling adds conceptual load.

### Mitigations
- Repository layer that requires `tenant_id`.
- Multi-tenant isolation tests.
- Currency validations per account.
- Clear documentation of financial rules.

## Alternatives Considered

1. **DB per tenant**
   - Greater isolation, but high operational complexity.

2. **Schema per tenant**
   - More complex migrations and tooling.

3. **Use of floats/decimals**
   - Rejected due to risk of financial errors.

4. **Automatic conversion in each transaction**
   - Rejected due to loss of traceability.

## Implementation Notes

- Use `bigint`/`integer` for `amount_minor`.
- Normalize currencies via ISO 4217.
- Validate currency when creating accounts and transactions.
- Do not add caching or sharding at this stage.

