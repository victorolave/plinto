#!/usr/bin/env bash
#
# Backs up the self-host Postgres database to backups/plinto-<timestamp>.dump,
# using pg_dump's custom format (--format=custom) so it can be restored later
# with restore.sh (which shells out to pg_restore).
#
# Reads POSTGRES_USER/POSTGRES_DB from the compose env file rather than from
# flags — the same file docker-compose.yml itself reads via
# PLINTO_ENV_FILE/--env-file (see the comment at the top of
# docker-compose.yml) — with grep/sed rather than `source`, so a malformed
# or hostile env file cannot execute arbitrary shell in this process.
#
# Usage:
#   ./deploy/backup.sh
#   PLINTO_ENV_FILE=deploy/self-host.env.example ./deploy/backup.sh

set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

ENV_FILE="${PLINTO_ENV_FILE:-.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "error: env file not found: $ENV_FILE" >&2
  exit 1
fi

read_env_var() {
  local name="$1" value
  value="$(grep -E "^${name}=" "$ENV_FILE" | tail -n1 | sed -E "s/^${name}=//")"
  if [[ -z "$value" ]]; then
    echo "error: $name is not set in $ENV_FILE" >&2
    exit 1
  fi
  printf '%s' "$value"
}

POSTGRES_USER="$(read_env_var POSTGRES_USER)"
POSTGRES_DB="$(read_env_var POSTGRES_DB)"

# --env-file is passed explicitly on every invocation (rather than relying on
# the caller having exported PLINTO_ENV_FILE, or on a file named exactly
# `.env` existing) so this script behaves the same regardless of the caller's
# shell state — see the "TWO DIFFERENT SUBSTITUTION MECHANISMS" comment atop
# docker-compose.yml for why Compose needs its own copy of this path.
COMPOSE=(docker compose --env-file "$ENV_FILE")

if ! "${COMPOSE[@]}" ps --status running --services 2>/dev/null | grep -qx postgres; then
  echo "error: the postgres service is not running (see 'docker compose ps')" >&2
  exit 1
fi

mkdir -p backups
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
DUMP_PATH="backups/plinto-${TIMESTAMP}.dump"

echo "Backing up database '$POSTGRES_DB' (user '$POSTGRES_USER') to $DUMP_PATH ..."

"${COMPOSE[@]}" exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom \
  > "$DUMP_PATH"

SIZE="$(du -h "$DUMP_PATH" | cut -f1 | tr -d '[:space:]')"
echo "Backup written: $DUMP_PATH ($SIZE)"
