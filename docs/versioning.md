# Versioning and releases

Plinto follows [Semantic Versioning 2.0.0](https://semver.org), starting at
`v0.1.0`. For a self-hosted application the question a version number has to
answer is not "did an internal function change" but **"will upgrading break my
installation?"** — so that is what the numbers mean here.

## What each number means

| Bump | Means | What you have to do |
|------|-------|---------------------|
| **MAJOR** | The upgrade breaks an existing installation | Read the changelog and follow the migration steps before upgrading |
| **MINOR** | New capability, existing installations keep working | `docker compose pull && docker compose up -d`. Database migrations run on their own |
| **PATCH** | Corrections only, no new capability | Same as minor |

## What counts as breaking

A change is breaking when a working installation stops working after the
upgrade, or needs a human to intervene. Concretely, the public contract is:

- The **HTTP API** under `/api` — removing an endpoint, removing a response
  field, or making an optional request field required.
- **Environment variables** — removing one, renaming one, or making a
  previously optional one required.
- The **self-host `docker-compose.yml`** — service names, ports, volumes.
- The **database schema**, when a migration cannot run unattended or loses
  data.

Anything else is internal: module structure, component names, the shape of
functions nobody outside the repository calls. Those change in a patch without
notice.

## While the version is 0.x

`0.x` is a promise that the shape is still moving. Under SemVer, a breaking
change during `0.x` ships as a **minor** bump, not a major one — `0.1.0` to
`0.2.0` may require manual steps, and the changelog will say so at the top of
the entry when it does.

This is deliberate. The HTTP API is still gaining endpoints (see
[roadmap](roadmap.md)), and pretending otherwise by releasing `1.0.0` today
would either freeze decisions too early or produce three major versions in the
first year, which reads as instability rather than maturity.

**`1.0.0` ships when the HTTP API stops moving** — when a self-hoster can
upgrade for a year without reading migration notes.

## Tags and images

| Artifact | Format | Example |
|----------|--------|---------|
| Git tag | `vMAJOR.MINOR.PATCH` | `v0.1.0` |
| Docker image | `MAJOR.MINOR.PATCH` and `latest` | `ghcr.io/victorolave/plinto-api:0.1.0` |

`latest` always points at the newest release. Pin the exact version in
production with `PLINTO_VERSION` so an upgrade is something you decide, not
something that happens.

Images are published by `.github/workflows/release.yml`, which fires on the
version tag. Tagging is therefore the whole release: it publishes the images
and the notes together, and the notes are lifted from this version's section
of the changelog rather than written twice.

## Every release has a changelog entry

[`CHANGELOG.md`](../CHANGELOG.md) records every release, newest first. An entry
that requires manual steps says so in its first line, before the list of
changes — nobody should have to read to the bottom to find out their upgrade
needs a database dump first.
