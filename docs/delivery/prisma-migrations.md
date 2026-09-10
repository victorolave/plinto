# Plinto Prisma Migration Policy

This document operationalizes **ADR 0004 §4 (Migrations)**: migrations are versioned,
reproducible, identical across SaaS and self-host, and executed in a controlled way.
Manual schema changes in production are not allowed.

Until now the repository had a Prisma schema but **no versioned migration history**,
which caused local drift after schema changes (see the account slice). This policy
closes that gap with a baselined migration history.

## Where migrations live

```
apps/api/src/infrastructure/database/prisma/
├── schema.prisma
└── migrations/
    ├── migration_lock.toml      # pins the provider (postgresql) — committed, never edited by hand
    └── 0_init/
        └── migration.sql        # baseline: full current schema (users, tenants, accounts,
                                 #           memberships, sessions, audit_events + enums)
```

The migrations directory is **committed to git**. It is the single source of truth for
the database structure and must always match `schema.prisma`.

## Available scripts (run from repo root)

| Script | Command | Use |
| --- | --- | --- |
| `pnpm --filter @plinto/api prisma:generate` | `prisma generate` | Regenerate the Prisma client after editing the schema. |
| `pnpm --filter @plinto/api prisma:migrate` | `prisma migrate dev` | **Local development.** Create + apply a new migration after a schema change. |
| `pnpm --filter @plinto/api prisma:status` | `prisma migrate status` | Inspect which migrations are applied / pending. |
| `pnpm --filter @plinto/api prisma:deploy` | `prisma migrate deploy` | **CI / production.** Apply pending migrations only. Never generates new ones. |
| `pnpm --filter @plinto/api prisma:baseline` | `prisma migrate resolve --applied 0_init` | Mark `0_init` as already applied on a pre-existing database. |

## Workflows

### A. Fresh database (new contributor, new environment)

```bash
pnpm --filter @plinto/api prisma:deploy     # applies 0_init and any later migrations
```

The database is created from the committed migration history. No drift, no guesswork.

### B. Existing database that already has the tables (current local/dev DBs)

The current schema was applied with `db push` / `migrate dev` before this baseline
existed, so the tables already exist but Prisma has no record of `0_init`. Mark it as
applied **once** so Prisma does not try to recreate existing tables:

```bash
pnpm --filter @plinto/api prisma:baseline   # records 0_init as applied
pnpm --filter @plinto/api prisma:status     # should report: up to date
```

### C. Changing the schema (every future slice that touches persistence)

1. Edit `schema.prisma`.
2. Create the migration with a descriptive name:

   ```bash
   pnpm --filter @plinto/api prisma:migrate -- --name add_transactions
   ```

3. Commit the generated `migrations/<timestamp>_add_transactions/` folder **together with**
   the schema change, in the same vertical slice.
4. CI/production picks it up automatically via `prisma:deploy`.

### D. Deployment / CI

Run `prisma:deploy` as part of the release step, before the API starts. It applies only
pending migrations and never alters anything not described by the migration history.

## Rules

- **Never** run `prisma db push` against a persistent environment. It mutates the schema
  without recording a migration and reintroduces drift. It is only acceptable for a
  throwaway scratch database.
- **Never** edit a migration that has already been applied to a shared environment. Add a
  new migration instead.
- **Never** apply manual SQL to production (ADR 0004 §4).
- Every persistence change ships with its migration in the **same slice / PR**
  (see the Definition of Done in `vertical-slices.md`).
- Migration names use `snake_case` describing the intent (`add_transactions`,
  `add_transfer_id_to_transactions`).
- `migration_lock.toml` is committed and never hand-edited.

## Drift recovery (local only)

If a local database diverges from the migration history and the data is disposable:

```bash
pnpm --filter @plinto/api exec prisma migrate reset   # drops, recreates, replays all migrations
```

For a database whose data must be preserved, do **not** reset. Reconcile by generating a
corrective migration with `prisma migrate diff` and reviewing the SQL before applying.

## Related documents

- `docs/adr/0004-persistence-multitenancy-multicurrency.md` — §4 establishes the migration principle.
- `docs/delivery/vertical-slices.md` — every slice must include its migration.
