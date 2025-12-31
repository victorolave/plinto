# ADR 0002: Shared Contracts with Zod for REST (End-to-End Validation and Typing)

- **Status**: Accepted
- **Date**: 2025-12-30
- **Deciders**: Plinto Maintainer(s)
- **Context**: API/Web contracts, runtime validation, and response consistency

## Context

Plinto is built as a monorepo with:

- `apps/api` in NestJS (main backend)
- `apps/web` in Next.js (frontend)
- shared packages in `packages/*`

The product targets two modes:

1. **SaaS** (multi-tenant)
2. **Self-hosted**

Both scenarios require:

- **Consistency** between backend and frontend (avoid drift in DTOs/payloads).
- **Runtime validation** (TypeScript doesn't validate at runtime).
- Clear and evolvable contracts for a **REST** API.
- Efficient development experience: less duplication, fewer bugs from misalignment.
- Foundation for versioning and compatibility, especially important in self-host (instances may be out of sync).

The use of typical NestJS DTOs with `class-validator` was evaluated, but it implies duplicating validations (frontend) and leaves the contract fragmented.

## Decision

1. **REST** will be Plinto's initial API style.
2. Contracts (request/response) will be defined in `packages/shared` using **Zod** as the source of truth.
3. TypeScript types will be derived from Zod schemas (`z.infer<>`) to ensure consistent typing.
4. In the backend (NestJS), input validation will be done with a **Zod Validation Pipe** (or equivalent).
5. In the frontend (Next.js), Zod will be reused for:
   - form and payload validation
   - parsing/validation of responses when relevant
6. API responses and errors will follow a uniform structure.

## Justification

### Why REST
- Operational and cognitive simplicity for an MVP.
- Good fit with NestJS and simple HTTP clients.
- Suitable for evolving to route-based versioning (`/api/v1/...`).

### Why Zod as shared contract
- Provides **runtime validation** and typing from a single artifact.
- Allows sharing rules between API and Web without duplication.
- Reduces typical errors (incomplete payloads, inconsistent types, fragile parsing).

### Why not `class-validator` as primary contract
- It's "idiomatic Nest", but doesn't share naturally with the frontend.
- Leads to duplicating schemas/validations (frontend and backend).
- Increases risk of drift and maintenance cost.

## Contract Specification

### Location
- `packages/shared`
  - `schemas/` (Zod schemas)
  - `types/` (derived types, optional if exported directly from schemas)
  - `errors/` (error codes and structure)
  - `http/` (pagination, filters, etc. helpers)

### Convention
- Each REST endpoint explicitly defines:
  - request schema (path/query/body) when applicable
  - response schema
  - expected error codes (and their structure)

## Standard Response and Error Format

Plinto will use a consistent format to simplify consumption in the frontend and observability:

- Successful response (minimum):
  - `data`: main payload
  - `meta` (optional): pagination, counts, etc.

- Error response (minimum):
  - `error.code`: stable string (e.g., `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`)
  - `error.message`: human-readable string
  - `error.details` (optional): list/fields with additional information (e.g., Zod issues)
  - `error.traceId` (optional): correlation with logs

## Consequences

### Positive
- A single shared contract reduces duplication and drift.
- Consistent validation in API and Web (same semantics).
- Better DX: safer refactors, reliable end-to-end typing.
- Solid foundation for self-host (explicit contracts + future versioning).

### Negative / Trade-offs
- Initial Zod integration in NestJS requires a pipe/abstraction (not "by default").
- Discipline must be defined to avoid "breaking" contracts without a versioning strategy.

### Mitigations
- Maintain a small and clear library of helpers:
  - `ZodValidationPipe`
  - error normalization (`zod -> error.details`)
- Adopt route-based versioning early if needed (see versioning section).

## Versioning and Compatibility

To facilitate SaaS and self-host:

- The route `/api/v1/...` will be reserved for initial endpoints when the API is consumed externally or by multiple clients.
- Incompatible changes will be reserved for a major version (`v2`).
- Compatible changes (new optional fields, new endpoints) are allowed in `v1`.

## Alternatives Considered

1. **NestJS DTOs with class-validator**
   - Pros: native integration in Nest.
   - Cons: duplication in frontend, fragmented contract, drift.

2. **OpenAPI-first (client and type generation)**
   - Pros: excellent for large ecosystems.
   - Cons: higher initial complexity; preferred to introduce later when the API grows.

3. **GraphQL**
   - Pros: strong typing and exploration.
   - Cons: additional complexity; REST is sufficient for the MVP.

## Implementation Notes

- `packages/shared` will export Zod schemas and derived types.
- `apps/api`:
  - Validate `body/query/params` with Zod through a pipe.
  - Convert Zod errors to the standard error structure.
- `apps/web`:
  - Reuse schemas to validate forms and payloads.
  - (Optional) Validate parsing of critical responses with Zod for resilience.

