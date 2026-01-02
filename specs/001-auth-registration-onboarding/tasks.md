# Tasks: Authentication, Registration, and Tenant Onboarding

**Input**: Design documents from `specs/001-auth-registration-onboarding/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Not requested for this feature.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create API entrypoint in `apps/api/src/main.ts`
- [X] T002 Create API root module in `apps/api/src/app.module.ts`
- [X] T003 [P] Scaffold API base folders under `apps/api/src/`
- [X] T004 [P] Create base App Router layout in `apps/web/src/app/layout.tsx`
- [X] T005 [P] Add global styles entrypoint in `apps/web/src/styles/globals.css`
- [X] T006 [P] Scaffold shared contract folders under `packages/shared/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T007 Configure environment validation in `apps/api/src/config/env.validation.ts`
- [X] T008 Configure runtime config loader in `apps/api/src/config/configuration.ts`
- [X] T009 Configure app constants in `apps/api/src/config/constants.ts`
- [X] T010 [P] Implement request-id middleware in `apps/api/src/common/middleware/request-id.middleware.ts`
- [X] T011 [P] Implement base HTTP exception filter in `apps/api/src/common/filters/http-exception.filter.ts`
- [X] T012 [P] Implement Zod validation pipe in `apps/api/src/common/pipes/zod-validation.pipe.ts`
- [X] T013 Set up Prisma database module in `apps/api/src/infrastructure/database/database.module.ts`
- [X] T014 Create Prisma service wrapper in `apps/api/src/infrastructure/database/prisma/prisma.service.ts`
- [X] T015 Define Prisma schema for User/Tenant/Membership/Session/AuditEvent in `apps/api/src/infrastructure/database/prisma/schema.prisma`
- [X] T016 Create initial migrations in `apps/api/src/infrastructure/database/migrations/`
- [X] T017 [P] Implement auth guard for session cookies in `apps/api/src/common/guards/auth.guard.ts`
- [X] T018 [P] Implement tenant context guard in `apps/api/src/common/guards/tenant.guard.ts`
- [X] T019 [P] Implement logger module in `apps/api/src/infrastructure/logger/logger.module.ts`
- [X] T020 Create API v1 router composition in `apps/api/src/routes/v1.routes.ts`
- [X] T021 Define shared error schema in `packages/shared/errors/error.schema.ts`
- [X] T022 Define shared user schema in `packages/shared/schemas/user.schema.ts`
- [X] T023 Define shared tenant schema in `packages/shared/schemas/tenant.schema.ts`
- [X] T024 Define shared membership schema in `packages/shared/schemas/membership.schema.ts`
- [X] T025 Define shared session schema in `packages/shared/schemas/session.schema.ts`
- [X] T026 Define shared auth/onboarding schema in `packages/shared/schemas/auth.schema.ts`
- [X] T027 Define shared HTTP response helpers in `packages/shared/http/response.schema.ts`
- [X] T028 Set up Web API client wrapper in `apps/web/src/lib/api/client.ts`
- [X] T029 Set up Web auth/session helpers in `apps/web/src/lib/auth/session.ts`
- [X] T030 Apply UI foundation tokens and Montserrat font in `apps/web/src/app/layout.tsx`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - First-time sign-in and onboarding (Priority: P1) 🎯 MVP

**Goal**: New users can sign in, complete profile, create their first tenant, and access the app.

**Independent Test**: Sign in as a new user, complete profile and tenant creation, then land on dashboard with an active tenant.

### Implementation for User Story 1

- [X] T031 [P] [US1] Define User entity in `apps/api/src/modules/users/domain/user.entity.ts`
- [X] T032 [P] [US1] Define Tenant entity in `apps/api/src/modules/tenants/domain/tenant.entity.ts`
- [X] T033 [P] [US1] Define Membership entity in `apps/api/src/modules/memberships/domain/membership.entity.ts`
- [X] T034 [P] [US1] Define Session entity in `apps/api/src/modules/sessions/domain/session.entity.ts`
- [X] T035 [P] [US1] Define AuditEvent entity in `apps/api/src/modules/audit/domain/audit-event.entity.ts`
- [X] T036 [P] [US1] Implement Prisma repositories in `apps/api/src/modules/*/infrastructure/*.repository.ts`
- [X] T037 [US1] Implement audit event writer in `apps/api/src/modules/audit/application/audit.service.ts`
- [X] T038 [US1] Implement user provisioning service in `apps/api/src/modules/users/application/user-provisioning.service.ts`
- [X] T039 [US1] Implement onboarding workflow service in `apps/api/src/modules/tenants/application/onboarding.service.ts`
- [X] T040 [US1] Implement session active-tenant service in `apps/api/src/modules/sessions/application/session.service.ts`
- [X] T041 [US1] Implement /me GET+PATCH in `apps/api/src/modules/users/interfaces/http/v1/users.controller.ts`
- [X] T042 [US1] Implement /tenants POST in `apps/api/src/modules/tenants/interfaces/http/v1/tenants.controller.ts`
- [X] T043 [US1] Implement /tenants/active POST in `apps/api/src/modules/sessions/interfaces/http/v1/active-tenant.controller.ts`
- [X] T044 [US1] Wire auth/users/tenants/sessions modules into v1 routes in `apps/api/src/routes/v1.routes.ts`
- [X] T045 [US1] Implement login entry page in `apps/web/src/app/(auth)/login/page.tsx`
- [X] T046 [US1] Implement OIDC callback handler in `apps/web/src/app/(auth)/callback/route.ts`
- [X] T047 [US1] Implement onboarding page in `apps/web/src/app/(auth)/onboarding/page.tsx`
- [X] T048 [US1] Build onboarding form component in `apps/web/src/features/auth/components/onboarding-form.tsx`
- [X] T049 [US1] Implement onboarding API service in `apps/web/src/features/auth/services/onboarding.ts`
- [X] T050 [US1] Re-export shared Zod schemas in `apps/web/src/features/auth/schemas/index.ts`

**Checkpoint**: User Story 1 is fully functional and testable independently

---

## Phase 4: User Story 2 - Returning user with one tenant (Priority: P2)

**Goal**: Returning users with a single tenant are auto-selected and land on the dashboard.

**Independent Test**: Sign in as a user with one tenant and confirm auto-selection + dashboard access.

### Implementation for User Story 2

- [X] T051 [US2] Implement /tenants GET in `apps/api/src/modules/tenants/interfaces/http/v1/tenants.controller.ts`
- [X] T052 [US2] Auto-select single-tenant session in `apps/api/src/modules/sessions/application/session.service.ts`
- [X] T053 [US2] Ensure /me response includes memberships + active tenant in `apps/api/src/modules/users/interfaces/http/v1/users.controller.ts`
- [X] T054 [US2] Add auth bootstrap hook in `apps/web/src/features/auth/hooks/use-auth-bootstrap.ts`
- [X] T055 [US2] Guard dashboard entry in `apps/web/src/app/(dashboard)/layout.tsx`

**Checkpoint**: User Stories 1 and 2 are independently functional

---

## Phase 5: User Story 3 - Returning user with multiple tenants (Priority: P3)

**Goal**: Users with multiple tenants can select and switch their active tenant.

**Independent Test**: Sign in as a multi-tenant user, select an active tenant, and access the dashboard.

### Implementation for User Story 3

- [X] T056 [US3] Implement /tenants/active GET in `apps/api/src/modules/sessions/interfaces/http/v1/active-tenant.controller.ts`
- [X] T057 [US3] Persist last active tenant in `apps/api/src/modules/sessions/infrastructure/session.repository.ts`
- [X] T058 [US3] Create tenant selection page in `apps/web/src/app/(auth)/select-tenant/page.tsx`
- [X] T059 [US3] Build tenant selector component in `apps/web/src/features/tenants/components/tenant-selector.tsx`
- [X] T060 [US3] Implement tenant selection service in `apps/web/src/features/tenants/services/tenant-selection.ts`
- [X] T061 [US3] Add tenant switcher to dashboard layout in `apps/web/src/app/(dashboard)/layout.tsx`

**Checkpoint**: All user stories are independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T062 [P] Verify audit events include tenant_id + request_id in `apps/api/src/modules/audit/application/audit.service.ts`
- [X] T063 [P] Update manual verification notes in `specs/001-auth-registration-onboarding/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: Depend on Foundational phase completion
- **Polish (Phase 6)**: Depends on desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Foundational - no dependencies on other stories
- **User Story 2 (P2)**: Starts after Foundational - builds on shared infrastructure
- **User Story 3 (P3)**: Starts after Foundational - builds on shared infrastructure

### Parallel Opportunities

- Foundational tasks marked [P] can run in parallel (middleware, guards, logger, shared schemas)
- User Story 1 domain/entity tasks marked [P] can run in parallel
- Web tasks for US1 can proceed in parallel with API service tasks once shared schemas are ready

---

## Parallel Example: User Story 1

```bash
# Launch domain entity work in parallel:
Task: "Define User entity in apps/api/src/modules/users/domain/user.entity.ts"
Task: "Define Tenant entity in apps/api/src/modules/tenants/domain/tenant.entity.ts"
Task: "Define Membership entity in apps/api/src/modules/memberships/domain/membership.entity.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL)
3. Complete Phase 3: User Story 1
4. Validate onboarding flow (new user sign-in, profile completion, tenant creation)

### Incremental Delivery

1. Foundation ready (Phases 1-2)
2. Deliver User Story 1 (MVP)
3. Add User Story 2 (single-tenant return flow)
4. Add User Story 3 (multi-tenant selection)
5. Polish cross-cutting items
