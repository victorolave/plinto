#!/usr/bin/env bash
#
# Restores a dump produced by backup.sh into the self-host Postgres database.
#
# Stops api/web first (so nothing writes mid-restore), runs
# `pg_restore --clean --if-exists --no-owner --no-privileges` (drops and
# recreates every object before restoring, so this also works against a
# database that already has data in it — not just an empty one), brings
# api/web back up, and checks GET /api/health through nginx.
#
# Usage:
#   ./deploy/restore.sh backups/plinto-20260902-110000.dump
#   ./deploy/restore.sh backups/plinto-20260902-110000.dump --yes   # skip the typed confirmation (automation)

set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

DUMP_FILE="${1:-}"
CONFIRM_FLAG="${2:-}"

if [[ -z "$DUMP_FILE" ]]; then
  echo "usage: $0 <dumpfile> [--yes]" >&2
  exit 1
fi

if [[ ! -f "$DUMP_FILE" ]]; then
  echo "error: dump file not found: $DUMP_FILE" >&2
  exit 1
fi

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

# PLINTO_HTTP_PORT is optional (docker-compose.yml itself defaults it to
# 8080), so it is read without going through read_env_var's "must be set"
# check.
HTTP_PORT="$(grep -E '^PLINTO_HTTP_PORT=' "$ENV_FILE" | tail -n1 | sed -E 's/^PLINTO_HTTP_PORT=//')"
HTTP_PORT="${HTTP_PORT:-8080}"

# --env-file is passed explicitly on every invocation (rather than relying on
# the caller having exported PLINTO_ENV_FILE, or on a file named exactly
# `.env` existing) so this script behaves the same regardless of the caller's
# shell state — see the "TWO DIFFERENT SUBSTITUTION MECHANISMS" comment atop
# docker-compose.yml for why Compose needs its own copy of this path.
COMPOSE=(docker compose --env-file "$ENV_FILE")

echo "About to restore '$DUMP_FILE' into database '$POSTGRES_DB' (user '$POSTGRES_USER')."
echo "This DROPS AND RECREATES every object in that database first (pg_restore --clean --if-exists)."
echo "The api and web containers will be stopped for the duration of the restore."
echo

if [[ "$CONFIRM_FLAG" != "--yes" ]]; then
  read -r -p "Type 'restore' to continue: " CONFIRMATION
  if [[ "$CONFIRMATION" != "restore" ]]; then
    echo "Aborted — nothing was changed."
    exit 1
  fi
fi

echo "Stopping api and web..."
"${COMPOSE[@]}" stop api web

echo "Restoring $DUMP_FILE ..."
"${COMPOSE[@]}" exec -T postgres \
  pg_restore --clean --if-exists --no-owner --no-privileges \
  -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  < "$DUMP_FILE"

echo "Starting api and web..."
"${COMPOSE[@]}" up -d api web

HEALTH_URL="http://localhost:${HTTP_PORT}/api/health"
echo "Waiting for $HEALTH_URL to report healthy..."

ATTEMPT=0
MAX_ATTEMPTS=30
until RESPONSE="$(curl -fsS "$HEALTH_URL" 2>/dev/null)"; do
  ATTEMPT=$((ATTEMPT + 1))
  if [[ "$ATTEMPT" -ge "$MAX_ATTEMPTS" ]]; then
    echo "error: $HEALTH_URL did not become healthy after ${MAX_ATTEMPTS} attempts — check 'docker compose logs api'." >&2
    exit 1
  fi
  sleep 2
done

echo "Restore complete. $HEALTH_URL -> $RESPONSE"
