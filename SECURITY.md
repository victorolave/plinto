# Security Policy

Plinto holds household financial records: balances, what a family owes, where
they bank. A vulnerability here is not an inconvenience. Please report one
privately so it can be fixed before it is public.

## Reporting a vulnerability

**Do not open a public issue.** Use either channel below:

1. **GitHub private vulnerability reporting** — the *Report a vulnerability*
   button under this repository's **Security** tab. It creates a private
   advisory only you and the maintainer can see.
2. **Email** — victorolave1131@gmail.com, with `SECURITY` in the subject.

Include whatever you have: what you did, what happened, what you expected, and
the version or commit you were running. A rough report sent today is worth more
than a polished one sent next month.

## What to expect

This project is maintained by one person alongside a job, and it would be
dishonest to promise a response time this repository cannot keep.

| Stage | What actually happens |
|-------|----------------------|
| Acknowledgement | You will hear back that the report arrived, normally within a few days |
| Assessment | The maintainer confirms or disputes the finding, and says which it is |
| Fix | Serious issues jump the queue ahead of features. Minor ones are scheduled and you are told when |
| Disclosure | A fixed issue is published in the release notes, crediting you unless you ask otherwise |

If a report goes unanswered for two weeks, assume it was missed rather than
ignored, and send it again.

## Scope

**In scope:** anything in this repository — the API, the web application, the
shared contracts, the Docker images published to `ghcr.io/victorolave`, the
compose file and the deployment scripts under `deploy/`.

**Out of scope:**

- Your OpenID Connect provider. Plinto authenticates against Auth0, Google,
  Keycloak or anything else standards-compliant, and stores no passwords. Bugs
  in the provider belong to the provider.
- A deployment misconfigured against its own documentation — `COOKIE_SECURE`
  turned off on a public HTTPS host, secrets left at their `REPLACE_ME`
  defaults, a database exposed to the internet. Tell us if the documentation
  invited the mistake; that part **is** in scope.
- Findings that require an attacker to already be an authenticated member of
  the household they are attacking, unless the finding lets them exceed their
  role. Roles are defined in
  [ADR 0007](docs/adr/0007-authorization-rbac-tenant-permissions.md).

## Supported versions

While Plinto is `0.x`, only the **latest release** receives fixes. There is no
backporting to older tags. See [versioning](docs/versioning.md).

Because Plinto is self-hosted, a fix only protects you once you upgrade. Watch
[releases](https://github.com/victorolave/plinto/releases) for the tag.

## What Plinto already does, so you know where to look

- No passwords are stored. Authentication is delegated to your OIDC provider.
- Sessions live server-side in PostgreSQL, in a cookie that is `HttpOnly`,
  `SameSite=Lax`, and `Secure` unless you explicitly turn that off for a
  plain-HTTP trial. Two limits apply and the first one wins: 30 minutes idle
  and 8 hours absolute.
- Every request carries a tenant, and tenant isolation is enforced by a guard
  rather than by each query remembering to filter.
- Financial operations are written to an audit trail with the actor and a
  correlation id.
