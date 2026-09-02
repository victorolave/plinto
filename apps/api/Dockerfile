# syntax=docker/dockerfile:1
#
# Production image for @plinto/api (NestJS). Build context MUST be the repo
# root (this is a pnpm/Turborepo monorepo and @plinto/api depends on the
# workspace package @plinto/shared):
#
#   docker build -f apps/api/Dockerfile -t plinto-api:local .
#
# Both stages use the same Debian base (node:22-bookworm-slim) on purpose:
# apps/api/src/infrastructure/database/prisma/schema.prisma declares no
# `binaryTargets`, so Prisma downloads engine binaries for whatever OS/libc
# it is generated on. Building on one base and running on another (e.g.
# Alpine/musl) would ship engines that don't match glibc at runtime.

ARG NODE_IMAGE=node:22-bookworm-slim

##############################################################################
# base — shared setup for both the build and runtime stages
##############################################################################
FROM ${NODE_IMAGE} AS base

# Prisma's query/migration engines link against libssl at runtime. bookworm's
# base install doesn't guarantee it's present once "slim" strips recommends,
# so it's installed explicitly rather than assumed.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# packageManager in the root package.json pins pnpm@9.0.0; corepack is how we
# honor that pin instead of whatever pnpm a bare `npm install -g pnpm` gives.
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Non-root runtime user, created once here so the runtime stage below only
# needs to COPY --chown into it rather than re-creating the user and
# chown -R'ing the whole tree as a separate layer.
RUN addgroup --system --gid 1001 plinto \
    && adduser --system --uid 1001 --ingroup plinto plinto

##############################################################################
# builder — installs the full workspace and builds @plinto/api and its
# workspace dependency (@plinto/shared) via Turborepo
##############################################################################
FROM base AS builder
WORKDIR /app

# Copy just the manifests first so `pnpm install` is cached across builds that
# only change application source.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

# apps/api's postinstall runs `prisma generate`, which needs the schema (and
# reads the migrations directory) to exist before `pnpm install` runs it —
# copied here, ahead of the rest of the source, for the same reason the
# package.json files are copied early.
COPY apps/api/src/infrastructure/database/prisma apps/api/src/infrastructure/database/prisma

RUN pnpm install --frozen-lockfile

# Now bring in the rest of the source (.dockerignore excludes node_modules,
# dist, .next, .git, etc., so this can't clobber what was just installed).
COPY . .

# Builds @plinto/shared first (Turborepo dependency graph), then @plinto/api.
RUN pnpm turbo build --filter=@plinto/api...

# `pnpm deploy` produces a self-contained package directory: apps/api's own
# files (including the already-built dist/ and the Prisma schema +
# migrations, since apps/api/package.json sets no restrictive "files" field)
# plus a node_modules pruned to production dependencies only, with the
# @plinto/shared workspace dependency inlined as a real directory instead of
# a symlink. This is what gets copied into the runtime stage.
RUN pnpm deploy --filter=@plinto/api --prod /app/out/api

##############################################################################
# runtime — minimal image that only runs `node dist/main.js` (and, as a
# deploy-time step, `prisma migrate deploy`)
##############################################################################
FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production

# `prisma migrate deploy` requires the Prisma CLI, which is a devDependency
# of @plinto/api (only ever invoked at build time via `postinstall: prisma
# generate`) and is therefore absent from the `--prod`-pruned bundle copied
# in below. Rather than reach into pnpm's content-addressable store layout
# (fragile: the exact `node_modules/.pnpm/...` path depends on pnpm's
# internal naming, which has changed across versions), install the CLI
# explicitly here, pinned to the exact version pnpm-lock.yaml resolves for
# @prisma/client today. @prisma/client and the CLI must share a version to
# avoid schema/engine mismatches — bump PRISMA_VERSION whenever
# apps/api/package.json's `prisma`/`@prisma/client` versions move.
ARG PRISMA_VERSION=5.22.0
RUN npm install --global prisma@${PRISMA_VERSION} \
    && npm cache clean --force

COPY --chown=plinto:plinto --from=builder /app/out/api ./

# The client generated during the build stage was written against that
# stage's node_modules layout, which still had the `prisma` devDependency
# present. `pnpm deploy --prod` then prunes devDependencies, which reshapes
# pnpm's content-addressable store keys (they're peer-qualified — e.g.
# `@prisma+client@5.22.0_prisma@5.22.0` — and removing the peer changes
# which key `@prisma/client` resolves through) and leaves the copied bundle
# pointing at a client that was never actually generated for it, failing at
# boot with "@prisma/client did not initialize yet". Regenerating here,
# against the final prod-only layout and using the CLI just installed above,
# is what makes the two agree. `prisma generate` only reads the schema — it
# never connects to DATABASE_URL — so this needs no database at build time.
RUN prisma generate

USER plinto

EXPOSE 3000

# No curl in a "slim" image — Node 22 ships a global fetch, so this avoids an
# extra apt package just for the healthcheck.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/main.js"]
