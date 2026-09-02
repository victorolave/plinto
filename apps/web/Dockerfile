# syntax=docker/dockerfile:1
#
# Production image for @plinto/web (Next.js App Router, standalone output).
# Build context MUST be the repo root (this is a pnpm/Turborepo monorepo and
# @plinto/web depends on the workspace package @plinto/shared):
#
#   docker build -f apps/web/Dockerfile -t plinto-web:local .
#
# NEXT_PUBLIC_API_BASE_URL is a *build*-time value: Next.js inlines
# `process.env.NEXT_PUBLIC_*` into the client bundle at build time (see
# apps/web/src/lib/api/client.ts and turbo.json's build task env list), so it
# cannot be changed by an env var at container start — only by rebuilding
# this image with a different --build-arg. It defaults to `/api`, which is
# correct for the shipped self-host topology (nginx proxies /api to the api
# service under the same origin as the browser) and should be left alone
# unless the web app is served from a different path or origin than the API.

ARG NODE_IMAGE=node:22-bookworm-slim

##############################################################################
# base — shared setup for both the build and runtime stages
##############################################################################
FROM ${NODE_IMAGE} AS base

# Non-root runtime user, created once here so the runtime stage below only
# needs to COPY --chown into it rather than re-creating the user and
# chown -R'ing the whole tree as a separate layer.
RUN addgroup --system --gid 1001 plinto \
    && adduser --system --uid 1001 --ingroup plinto plinto

##############################################################################
# builder — installs the full workspace and builds @plinto/web and its
# workspace dependency (@plinto/shared) via Turborepo
##############################################################################
FROM base AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Copy just the manifests first so `pnpm install` is cached across builds that
# only change application source.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

# This installs the whole workspace, including @plinto/api, whose postinstall
# runs `prisma generate` — that needs the schema (and reads the migrations
# directory) to exist before `pnpm install` runs it, even though this image
# never uses the API's own build output.
COPY apps/api/src/infrastructure/database/prisma apps/api/src/infrastructure/database/prisma

RUN pnpm install --frozen-lockfile

# Now bring in the rest of the source (.dockerignore excludes node_modules,
# dist, .next, .git, etc., so this can't clobber what was just installed).
COPY . .

ARG NEXT_PUBLIC_API_BASE_URL=/api
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}

# Builds @plinto/shared first (Turborepo dependency graph), then @plinto/web.
# `output: 'standalone'` (apps/web/next.config.js) makes `next build` also
# trace and emit .next/standalone: a pruned server bundle containing only the
# production dependencies this app's import graph actually reaches, plus a
# generated apps/web/server.js entrypoint — copied into the runtime stage
# below instead of the full node_modules tree.
RUN pnpm turbo build --filter=@plinto/web...

##############################################################################
# runtime — minimal image that only runs the standalone Next.js server
##############################################################################
FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Next's standalone output traces the *workspace* root when built inside a
# monorepo (Turborepo/pnpm), not just the app directory, so the server
# entrypoint and this app's own files live under apps/web/... inside
# .next/standalone rather than at its root — verified by inspecting a local
# build: apps/web/.next/standalone/apps/web/server.js.
COPY --chown=plinto:plinto --from=builder /app/apps/web/.next/standalone ./
COPY --chown=plinto:plinto --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --chown=plinto:plinto --from=builder /app/apps/web/public ./apps/web/public

USER plinto

EXPOSE 3000

# No curl in a "slim" image — Node 22 ships a global fetch, so this avoids an
# extra apt package just for the healthcheck. redirect: 'manual' + accepting
# any status below 500 means a redirect to /login (e.g. an unauthenticated
# root request) or the login page itself both count as healthy; only a
# server error means the process is unhealthy.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/login', { redirect: 'manual' }).then(r => process.exit(r.status < 500 ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "apps/web/server.js"]
