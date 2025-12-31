# ADR 0001: Monorepo with Turborepo; API in NestJS; Web in Next.js

- **Status**: Accepted
- **Date**: 2025-12-30
- **Deciders**: Plinto Maintainer(s)
- **Context**: Initial architecture and repository organization

## Context

Plinto aims to evolve into a usable product in two modes:

1. **SaaS** (multi-tenant) operated by the team/maintainer.
2. **Self-hosted** for users willing to operate their own instance.

The project will be built with TypeScript. Requirements include:

- Clear separation between frontend and backend.
- Ability to share contracts (types/DTOs/schemas) between applications.
- Repository scalability for the future (additional apps, workers, shared packages).
- DX optimization (unified scripts, build/test caching, efficient CI).
- Minimize over-engineering in early phase while maintaining a solid foundation.

Alternatives evaluated: separate repositories, monorepo without orchestrator, Nx, and "fullstack Next.js" approaches without a dedicated backend.

## Decision

A **monorepo** managed with **Turborepo** is adopted, with the following main applications:

- **API**: **NestJS** (`apps/api`) as the main backend (domain rules, persistence, multi-tenancy, integrations, future jobs/workers).
- **Web**: **Next.js** (`apps/web`) as the frontend for the SaaS/self-hosted experience (routing, layouts, optional SSR, product optimizations).

Additionally, a set of shared packages is created:

- `packages/shared`: shared contracts (types, DTOs and/or validation schemas).
- `packages/config`: shared configuration (biome, tsconfig).

## Justification

### Why monorepo
- Facilitates **co-evolution** of API and Web.
- Allows **sharing contracts** (types/DTOs/schemas) without duplication.
- Simplifies standardization of tooling (lint/test/build) and long-term maintenance.
- Aligns architecture with the SaaS + self-host goal (a consistent distribution of the system).

### Why Turborepo
- Provides **pipelines** and **caching** for builds/tests/lint, reducing times in development and CI.
- Pragmatic and less intrusive than heavier alternatives for the current stage.
- Scales well when adding apps (admin, docs, workers) and packages (ui, sdk).

### Why NestJS for API
- Provides modular structure, solid patterns, and ergonomics for:
  - domain and business rules
  - authentication/authorization
  - validation and serialization
  - integrations and jobs
  - evolution toward more complex architecture without degrading design
- In a SaaS scenario, centralizes critical logic and facilitates control of the multi-tenant model.

### Why Next.js for Web
- Offers a robust foundation for a web product:
  - application routing and layouts
  - optional SSR/SSG (useful for public pages or performance)
  - good DX and mature ecosystem
- Avoids setting up additional infrastructure for common product needs.
- Does not replace the backend: Web remains as an API client, with minimal server logic when necessary.

## Consequences

### Positive
- Clear architecture: **API (Nest) as source of truth** and **Web (Next) as UI**.
- Contract reuse through `packages/shared`.
- Better DX and more efficient CI through Turborepo caching.
- Consistent foundation to grow into:
  - workers (queues, notifications, sync)
  - additional apps (admin, docs)
  - self-host with Docker Compose (api + web + db)

### Negative / Trade-offs
- Operation with **two server-side processes** in deployments (Nest and Next).
- Requires discipline to avoid Next.js becoming a "parallel backend".
- Slightly higher initial complexity than a single "fullstack Next" repo.

### Mitigations
- Define explicit boundaries:
  - Domain logic and persistence live in Nest.
  - Next only implements UI and minimal logic (e.g., auth callbacks, occasional SSR).
- Establish shared contracts in `packages/shared` and avoid improper cross-imports.
- Keep the monorepo minimal at the start (only `api`, `web`, `shared`, `config`).

## Alternatives Considered

1. **Separate repositories (API and Web)**
   - Rejected due to friction in coordination, contract duplication, and worse DX.

2. **Monorepo without Turborepo**
   - Rejected due to loss of caching/pipelines and lower CI efficiency as it grows.

3. **Nx**
   - Rejected due to higher complexity/learning curve and weight for the early phase, though viable in the future.

4. **Next.js fullstack (without NestJS)**
   - Rejected due to risk of architecture degradation when the backend grows (jobs, integrations, modules, multi-tenancy) and likely need to reintroduce services/workers later.

5. **React SPA (Vite) + NestJS**
   - Viable, but Next.js is preferred for product ergonomics, routing, and optional SSR.

## Implementation Notes

- Recommended structure:
  - `apps/api` (NestJS)
  - `apps/web` (Next.js)
  - `packages/shared` (contracts)
  - `packages/config` (biome/tsconfig)
- Recommended package manager: `pnpm` (workspaces).
- Conventions:
  - `apps/*` depend on `packages/*`
  - `packages/*` do not depend on `apps/*`

