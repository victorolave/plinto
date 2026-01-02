# Implementation Plan: Authentication, Registration, and Tenant Onboarding

**Branch**: `001-auth-registration-onboarding` | **Date**: 2026-01-01 | **Spec**: specs/001-auth-registration-onboarding/spec.md
**Input**: Feature specification from `specs/001-auth-registration-onboarding/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Deliver OIDC-based sign-in with application-owned sessions, just-in-time user provisioning, and mandatory onboarding for profile completion and first-tenant creation. Implement active-tenant selection (including last-used selection), strict tenant isolation, and audit events for tenant and membership creation. Use shared REST contracts and Zod validation to keep Web and API aligned.

## Technical Context

**Language/Version**: TypeScript (Node.js LTS)  
**Primary Dependencies**: NestJS (API), Next.js (Web), Prisma, Zod, Turborepo, pnpm  
**Storage**: PostgreSQL  
**Testing**: Jest (unit/integration), Supertest (API)  
**Target Platform**: Linux server (containerized) and modern browsers  
**Project Type**: Web application (frontend + backend)  
**UI Foundation**: `docs/design/foundation.md` (radix-vega tokens, Montserrat base font, primary #FD5447)  
**Performance Goals**: Onboarding requests should complete with sub-300ms p95 server latency under normal load; logout should revoke access within 5 seconds  
**Constraints**: OIDC-agnostic auth, httpOnly cookie sessions, tenant_id required for all tenant-scoped access, audit events for onboarding actions, no cross-tenant access  
**Scale/Scope**: MVP serving early adopters with multiple tenants per user and low-to-moderate concurrency

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- PASS: Financial correctness unaffected (no monetary amounts in scope).
- PASS: Multi-tenancy boundary enforced by tenant_id on all tenant-scoped access.
- PASS: Contract-first REST with shared Zod schemas and consistent error shape.
- PASS: Audit events emitted for tenant and membership creation with tenant_id and correlation id.
- PASS: SaaS and self-host parity maintained (config-driven IdP and storage).
- PASS: Calm UX with clear states for unauthenticated, onboarding, and tenant selection.

## Project Structure

### Documentation (this feature)

```text
specs/001-auth-registration-onboarding/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
apps/
├── api/
│   └── src/
│       ├── main.ts
│       ├── app.module.ts
│       ├── config/
│       │   ├── env.validation.ts
│       │   ├── configuration.ts
│       │   └── constants.ts
│       ├── common/
│       │   ├── decorators/
│       │   ├── guards/
│       │   ├── interceptors/
│       │   ├── filters/
│       │   ├── pipes/
│       │   ├── middleware/
│       │   ├── utils/
│       │   └── types/
│       ├── infrastructure/
│       │   ├── database/
│       │   │   ├── prisma/ (default; abstraction allows future swap)
│       │   │   ├── migrations/
│       │   │   └── database.module.ts
│       │   ├── cache/
│       │   ├── logger/
│       │   └── messaging/ (if applicable)
│       ├── modules/
│       │   ├── auth/
│       │   │   ├── domain/
│       │   │   ├── application/
│       │   │   ├── infrastructure/
│       │   │   └── interfaces/
│       │   │       └── http/
│       │   │           ├── v1/
│       │   │           │   ├── auth.controller.ts
│       │   │           │   └── dto/
│       │   │           └── v2/ (when it exists)
│       │   ├── users/
│       │   │   └── (same pattern)
│       │   ├── tenants/
│       │   ├── memberships/
│       │   ├── sessions/
│       │   └── audit/
│       └── routes/
│           ├── v1.routes.ts
│           └── v2.routes.ts
└── web/
    └── src/
        ├── app/
        │   ├── (marketing)/
        │   ├── (auth)/
        │   ├── (dashboard)/
        │   ├── api/
        │   ├── layout.tsx
        │   ├── page.tsx
        │   ├── error.tsx
        │   ├── not-found.tsx
        │   └── global-error.tsx
        ├── features/
        │   ├── auth/
        │   │   ├── components/
        │   │   ├── hooks/
        │   │   ├── actions/
        │   │   ├── services/
        │   │   ├── schemas/
        │   │   ├── types.ts
        │   │   └── index.ts
        │   ├── tenants/
        │   ├── users/
        │   └── ...
        ├── components/
        │   ├── ui/
        │   ├── layout/
        │   └── common/
        ├── lib/
        │   ├── config/
        │   ├── constants/
        │   ├── utils/
        │   ├── auth/
        │   ├── api/
        │   └── validation/
        ├── styles/
        │   └── globals.css
        ├── types/
        │   └── global.d.ts
        └── tests/

packages/
├── shared/
│   ├── schemas/
│   ├── errors/
│   └── http/
└── config/
```

**Structure Decision**: Monorepo with `apps/api`, `apps/web`, and `packages/shared` per ADR 0001; API follows a clean architecture module layout under `apps/api/src/modules` with versioned HTTP interfaces and centralized versioned routes. Web stays API-only (no direct DB access) and uses Zod schemas from `packages/shared` as the source of truth.

## Complexity Tracking

No constitution violations; no additional complexity justification required.
