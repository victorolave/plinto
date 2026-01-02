# Data Model: Authentication, Registration, and Tenant Onboarding

## Overview

Core entities are User, Tenant, Membership, Session, and AuditEvent. Users are global identities; tenant-scoped data is isolated via tenant_id on tenant-owned tables.

## Entities

### User

| Field | Type | Notes |
|------|------|------|
| id | uuid | Primary key |
| idp_sub | string | Unique external subject identifier |
| email | string | Unique contact email |
| name | string | Required for active access |
| created_at | timestamp | Creation time |
| updated_at | timestamp | Last update time |

### Tenant

| Field | Type | Notes |
|------|------|------|
| id | uuid | Primary key |
| name | string | Required |
| base_currency | string | ISO 4217, default COP |
| created_at | timestamp | Creation time |
| updated_at | timestamp | Last update time |

### Membership

| Field | Type | Notes |
|------|------|------|
| id | uuid | Primary key |
| tenant_id | uuid | Required, FK to Tenant |
| user_id | uuid | Required, FK to User |
| role | enum | owner, member, viewer |
| created_at | timestamp | Creation time |
| updated_at | timestamp | Last update time |

### Session

| Field | Type | Notes |
|------|------|------|
| id | uuid | Primary key |
| user_id | uuid | Required, FK to User |
| tenant_id | uuid | Nullable until selected |
| created_at | timestamp | Creation time |
| expires_at | timestamp | TTL for session |
| revoked_at | timestamp | Null unless revoked |
| last_seen_at | timestamp | For idle tracking |
| user_agent | string | Optional metadata |
| ip_address | string | Optional metadata |

### AuditEvent

| Field | Type | Notes |
|------|------|------|
| id | uuid | Primary key |
| tenant_id | uuid | Required |
| actor_user_id | uuid | Nullable when system actor |
| action | string | e.g., tenant.create |
| resource_type | string | e.g., tenant |
| resource_id | uuid | Optional |
| source | enum | manual, job, import |
| correlation_id | string | request_id or job_id |
| created_at | timestamp | Event time |
| metadata | json | Small, non-sensitive details |

## Relationships

- User 1..* Membership
- Tenant 1..* Membership
- User 1..* Session
- Tenant 1..* Session (via active tenant)
- Tenant 1..* AuditEvent

## Validation Rules

- User.idp_sub is unique and required.
- User.name must be present to complete onboarding.
- Tenant.base_currency must be a valid ISO 4217 code; defaults to COP.
- Membership is unique by (tenant_id, user_id).
- Session.tenant_id must reference a tenant the user is a member of.
- All tenant-scoped queries filter by tenant_id.

## State Transitions

- User onboarding: created -> profile completed (name set) -> tenant created (membership owner).
- Session: active -> expired or revoked (access denied).
