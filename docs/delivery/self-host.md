# Self-Hosting Plinto

This is the operator's guide for running Plinto yourself with Docker Compose
(ADR 0005). It covers the happy path, the two things that trip people up
(OIDC redirect URI, `COOKIE_SECURE`), day-to-day operation, and recovery.

## Prerequisites

- Docker and Docker Compose v2 (`docker compose version`).
- An OIDC provider you control a client registration on — Auth0, Google,
  Keycloak, Authentik, or anything else that speaks standard OIDC. Plinto's
  web app is the OIDC client; there is no built-in identity provider.
- A place to reach this deployment from a browser: `localhost` for a local
  trial, or a real domain/IP for anything long-lived.

## Quick path

```bash
git clone https://github.com/<your-fork-or-upstream>/plinto.git
cd plinto
cp deploy/self-host.env.example .env
```

Edit `.env`:

1. Fill in every `REPLACE_ME` (`POSTGRES_PASSWORD`, `INTERNAL_API_KEY`,
   `JWT_SECRET` — generate each with `openssl rand -hex 32`).
2. Set `PLINTO_PUBLIC_URL` to how you'll reach this instance (e.g.
   `http://localhost:8080` for a local trial), then set `WEB_ORIGIN` and
   `OIDC_REDIRECT_URI` to match it — see [OIDC setup](#oidc-setup) below.
3. Fill in `OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` from
   your provider.

Then:

```bash
docker compose up -d --build
docker compose ps          # wait until api, web, postgres show "healthy"
```

Open `http://localhost:8080` (or whatever `PLINTO_PUBLIC_URL` you set).

**Why the file must be named `.env`:** `docker-compose.yml` reads several
values (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `DATABASE_URL`,
...) directly via Compose's own variable substitution, which only ever looks
at a file literally named `.env` in this directory — or at whatever file you
pass with `docker compose --env-file <path>`. Naming your copy anything else
(without also passing `--env-file`) means postgres starts with empty
credentials. If you do want a differently-named or differently-located file,
use `docker compose --env-file path/to/your-file up -d --build` instead of
the plain `docker compose up`.

## OIDC setup

Register Plinto as a client application with your OIDC provider. The one
value that must match exactly, character for character, is the redirect
URI:

```
<PLINTO_PUBLIC_URL>/callback
```

For example, if `PLINTO_PUBLIC_URL=https://plinto.example.com`, register
`https://plinto.example.com/callback` and set
`OIDC_REDIRECT_URI=https://plinto.example.com/callback` in `.env` — the
value the provider redirects to and the value Plinto expects have to be
identical, or the login callback fails.

## The `COOKIE_SECURE` gotcha

**Symptom:** you log in, the provider redirects back, and you land on
`/login` again instead of the dashboard — silently, no error shown.

**Cause:** `COOKIE_SECURE=true` (the default whenever `NODE_ENV=production`
and the variable is unset) marks the session cookie `Secure`, which browsers
refuse to store or send over plain HTTP. The login *succeeds* server-side;
the browser just throws the cookie away.

**Fix:** `deploy/self-host.env.example` ships `COOKIE_SECURE=false` for
exactly this reason. Leave it `false` until nginx (or whatever sits in front
of it) actually terminates TLS, then flip it to `true` — see the commented
TLS block in `deploy/nginx/default.conf`.

## The scheduler

The `api` container runs an in-process scheduler (`JOBS_SCHEDULER_ENABLED=true`
by default in `docker-compose.yml`) that materializes upcoming obligations
once a day, on `JOBS_CRON` (default `0 6 * * *`) in `JOBS_TIMEZONE` (default
`America/Bogota`), `JOBS_HORIZON_MONTHS` months ahead. Confirm it's running:

```bash
docker compose logs api | grep -i scheduler
# [ScheduledJobsService] In-process scheduler enabled: cron="0 6 * * *" timezone="America/Bogota"
```

Self-host is single-instance, so this is safe to leave on. To trigger a
backfill immediately instead of waiting for the next tick, call the internal
endpoint directly with your `INTERNAL_API_KEY`:

```bash
curl -X POST http://localhost:8080/api/internal/obligations/generate \
  -H "x-internal-key: $INTERNAL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"horizonMonths": 3}'

curl -X POST http://localhost:8080/api/internal/recurring/execute \
  -H "x-internal-key: $INTERNAL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Upgrading

```bash
git pull
docker compose up -d --build
```

The `migrate` service runs `prisma migrate deploy` and must exit
successfully before `api` starts (`docker-compose.yml` enforces this via
`depends_on: migrate: condition: service_completed_successfully`) — you
never need to run migrations by hand. Check `docker compose logs migrate` if
`api` doesn't come up after an upgrade.

## Backup and restore

Postgres data lives in the named volume `plinto-postgres-data`. Back it up
with `pg_dump` rather than copying the volume directly, so a restore isn't
tied to matching Postgres versions. Two scripts wrap this so the day you
actually need a restore isn't the first time you run one:

```bash
# Backup — writes backups/plinto-<timestamp>.dump (pg_dump --format=custom)
./deploy/backup.sh

# Restore — stops api/web, pg_restore --clean --if-exists's the dump back in,
# brings api/web back up, and polls /api/health until it reports healthy.
# Prompts you to type "restore" first; pass --yes to skip that (automation).
./deploy/restore.sh backups/plinto-20260902-110000.dump
```

Both read `POSTGRES_USER`/`POSTGRES_DB` from the same env file Compose itself
uses (`PLINTO_ENV_FILE`, default `.env`) — no flags to keep in sync with your
`.env` by hand.

**Manual equivalent**, if you'd rather not use the scripts (or need to adapt
the command for something they don't cover):

```bash
# Backup
docker compose exec -T postgres pg_dump -U plinto -d plinto --format=custom > backup-$(date +%F).dump

# Restore (drops and recreates every object first — do not run this against
# a database you meant to keep untouched)
docker compose exec -T postgres pg_restore --clean --if-exists --no-owner --no-privileges -U plinto -d plinto < backup-2026-09-02.dump
```

Substitute your actual `POSTGRES_USER`/`POSTGRES_DB` if you changed them
from the example.

**Test a restore before you need one.** A backup you have never restored is
a guess, not a backup. Periodically — before an upgrade you're nervous about,
or just on a schedule — copy a recent dump to a scratch machine (or a second
`docker compose -p plinto-restore-drill` project on the same host, pointed at
a throwaway `.env`) and run `deploy/restore.sh` against it. The two things a
drill catches that nothing else will: a dump that silently stopped being
produced, and a restore step that only worked when you last wrote it down.

**Retention.** `deploy/backup.sh` never deletes anything — `backups/` will
grow forever if left alone. Prune it yourself (a `find backups -mtime +30
-delete` in cron, or whatever your platform's own snapshotting offers) and
keep at least one copy somewhere other than this host — a volume backup and
its host are usually lost together.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `curl http://localhost:8080/api/health` doesn't return `{"status":"ok"}` | `docker compose logs api` — a `503`/`"status":"error"` body means the API is up but can't reach Postgres. |
| Login redirects back to `/login` | See [The `COOKIE_SECURE` gotcha](#the-cookie_secure-gotcha) above. |
| `api` never becomes healthy after `up -d` | `docker compose logs migrate` — if it failed or is still running, `api` is waiting on it by design. |
| Provider rejects the callback | Redirect URI mismatch — see [OIDC setup](#oidc-setup); it must match byte-for-byte. |
| Nothing on port 8080 | Check `PLINTO_HTTP_PORT` in `.env`; nginx is the only service that publishes a port. |

For anything else, `docker compose logs <service>` (`postgres`, `migrate`,
`api`, `web`, `nginx`) is the first thing to check — every service logs to
stdout/stderr, nothing is written to a file inside the containers.
