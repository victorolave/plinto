# Changelog

Every release, newest first. Plinto follows
[Semantic Versioning](docs/versioning.md); an entry that needs manual steps
says so in its first line.

## [0.1.0] — 2026-09-10

First Community release. No manual steps: this is the starting point.

### Households and access

- Sign in through any OpenID Connect provider. Plinto stores no passwords.
  Setup guides for Google and Auth0 in
  [docs/delivery/oidc-providers.md](docs/delivery/oidc-providers.md).
- One account can belong to several households and switch between them without
  signing in again.
- Invite people to a household, with per-household roles and permissions.

### Money

- **Accounts** — bank, cash and liability accounts, each with its own currency
  from a fixed list of eleven codes.
- **Movements** — income and expenses, transfers between accounts including
  across currencies, and categories. The ledger is filtered and paginated on
  the server, so a household past a hundred movements searches all of them.
- **Idempotent transfers** — `POST /transactions/transfers` accepts an
  optional `Idempotency-Key` header. Repeat it for a retried submission and no
  second transfer is created; the original is returned instead.
- **Recurring rules** — define a monthly movement once and let it record
  itself.
- **Obligations** — what the household owes this month, generated from rules,
  settled either by recording the payment on the spot or by linking a movement
  already in the ledger.
- **Debts and loans** — schedules, outstanding balances, and what is owed to
  each lender.
- **Credit lines and cards** — statements per cutoff, revolving balance and
  available credit.
- **Spending by category** — the one report in this release. See the
  [roadmap](docs/roadmap.md#3-reports-beyond-spending-by-category).

### Getting oriented

- A dashboard with balances, recent activity, and a checklist of first steps.
- A guided tour, replayable at any time from **Help**.
- A sample household, so the app is not an empty shell on first run.

### Your data

- Export the whole household as JSON, or the ledger as CSV, from **Settings**.
- `deploy/backup.sh` and `deploy/restore.sh` wrap `pg_dump` and `pg_restore`
  for database-level backups.
- Importing an export back into a running instance is **not** in this release.
  See the [roadmap](docs/roadmap.md#1-importing-data-back-in).

### Running it yourself

- `docker-compose.yml` with nginx, web, API and PostgreSQL, pulling published
  images from `ghcr.io/victorolave` — no build step to sit through. Set
  `PLINTO_VERSION` to pin a version, or pass `--build` to build from source.
- Scheduled jobs for the obligations engine, in-process or through a workflow.
- Audit log of financial operations.
- Full guide in [docs/delivery/self-host.md](docs/delivery/self-host.md).

### License

- AGPL-3.0-only. The name **Plinto** and its logo are trademarks and are not
  covered by the license.
