# ADR 0005: Distribution and Deployment (SaaS and Self-Host) with Nginx

- **Status**: Accepted — Implemented (2026-09-02)
- **Date**: 2025-12-30
- **Deciders**: Plinto Maintainer(s)
- **Context**: Deployment, distribution, and system operation

## Implementation Notes (2026-09-02)

The decisions below are implemented:

- Production `Dockerfile`s for both images (`apps/api/Dockerfile`,
  `apps/web/Dockerfile`), and `docker-compose.yml` wiring nginx, web, api,
  postgres, and a one-shot `migrate` service that runs `prisma migrate
  deploy` before `api` starts.
- `deploy/nginx/default.conf` routes `/` to web and `/api/` to api under one
  origin, forwarding `Host`, `X-Real-IP`, `X-Forwarded-For`,
  `X-Forwarded-Proto`, and `X-Request-Id`.
- `GET /api/health` implemented (checks database connectivity), used by both
  the container `HEALTHCHECK` and the troubleshooting guide.
- `COOKIE_SECURE` implemented as an explicit override (defaults to
  `NODE_ENV === 'production'` when unset) — see
  `apps/web/src/lib/auth/cookie-options.ts`.
- `COOKIE_DOMAIN` and `COOKIE_SAMESITE` are **not** implemented: serving web
  and api under a single origin via nginx (this ADR's own §3) makes them
  unnecessary — there is only one origin for the cookie to be scoped to, and
  `SameSite=Lax` is hardcoded rather than configurable.
- TLS termination is delegated to a proxy placed in front of this stack by
  default (a managed load balancer, Caddy, Traefik, ...); `deploy/nginx/default.conf`
  ships a commented block for operators who want this nginx to terminate TLS
  itself instead.

See `docs/delivery/self-host.md` for the operator-facing guide.

## Context

Plinto must be able to operate in two modes:

1. **SaaS**, managed by the team/maintainer.
2. **Self-host**, deployed and operated by the end user.

Both modes must share the same codebase and differ only in configuration and infrastructure, avoiding forks or environment-specific conditional logic.

The system uses:
- API in NestJS
- Web in Next.js
- OIDC authentication with cookie-based sessions
- PostgreSQL as the database
- Monorepo managed with Turborepo

The deployment must be:
- reproducible
- simple to operate
- compatible with cookies and OIDC
- suitable for self-host with a low entry curve

## Decision

### 1. Distribution Strategy

A **single product** is adopted with two modes of operation:
- SaaS
- self-host

Differences between modes are handled exclusively through:
- environment variables
- service composition (infrastructure)
- deployment configuration

No separate code branches are maintained.

### 2. Containerization

All applications are distributed as **Docker images**:

- `plinto-api` (NestJS)
- `plinto-web` (Next.js)
- `postgres`
- `nginx` (reverse proxy)

This ensures consistency between environments and facilitates reproducible deployments.

### 3. Reverse Proxy

**Nginx** is adopted as the standard reverse proxy for both SaaS and self-host.

Nginx responsibilities:
- TLS termination
- HTTP routing
- serving Web and API under the same site
- forwarding necessary headers (cookies, auth, request-id)

Recommended configuration:
- Web and API under the same base domain to avoid cookie issues:
  - `/` → Web (Next.js)
  - `/api` → API (NestJS)

This approach simplifies:
- `SameSite` cookies
- CORS
- security configuration

### 4. Self-Host: Docker Compose

Self-host mode is distributed via **Docker Compose**.

Includes:
- `docker-compose.yml`
- `.env.example`
- services:
  - nginx
  - web
  - api
  - postgres

Explicit goal:
> Launch Plinto self-host with a single command.

Users can adapt the compose to their environment without modifying the code.

### 5. Configuration via Environment Variables

All configuration is managed through **environment variables**:

- Database connection
- OIDC configuration:
  - `OIDC_ISSUER_URL`
  - `OIDC_CLIENT_ID`
  - `OIDC_CLIENT_SECRET`
  - `OIDC_REDIRECT_URI`
- Cookie configuration:
  - `COOKIE_DOMAIN`
  - `COOKIE_SECURE`
  - `COOKIE_SAMESITE`
- Public URLs and trusted origins

A versioned `.env.example` is provided.

The application validates configuration at startup and fails explicitly if it is invalid or incomplete.

### 6. Database Migrations

Migrations:
- are an explicit part of the deployment process
- are executed before starting the API in production

In self-host with Docker Compose:
- a dedicated migration service can be used, or
- migrations are executed as a documented previous step

No implicit or silent migrations are performed.

### 7. Minimal Observability

A minimal and sufficient strategy is adopted:

- structured logs (JSON)
- request/trace id propagated by Nginx
- health check endpoint (`/health`)
- readiness/liveness for containers

This allows operating SaaS without introducing excessive complexity.

### 8. Versioning and Releases

Semantic versioning is adopted:

- Initial phase: `v0.x`
- Versioned and tagged releases
- Docker images published by version

Each release includes:
- changelog
- upgrade instructions (especially for self-host)

## Consequences

### Positive
- Same code for SaaS and self-host.
- Reproducible and simple deployment.
- Cookies working without complex CORS configurations.
- Infrastructure understandable for third parties.
- Controlled migrations and upgrades.

### Negative / Trade-offs
- Nginx requires explicit configuration.
- Less initial flexibility compared to "managed" solutions.

### Mitigations
- Base Nginx configuration versioned and documented.
- Possibility to adapt Nginx to more complex environments without touching the app.
- Reverse proxy decoupled from the application core.

## Alternatives Considered

1. **Caddy**
   - Simpler for TLS, but less standard in traditional environments.

2. **Deployment without reverse proxy**
   - Rejected due to cookie, TLS, and security issues.

3. **Different infrastructure for SaaS and self-host**
   - Rejected due to fragmentation and maintenance cost.

## Implementation Notes

- Nginx must forward headers:
  - `Host`
  - `X-Forwarded-For`
  - `X-Forwarded-Proto`
- Cookies must be configured for the base domain.
- No complex orchestrator (Kubernetes) is assumed at this stage.

