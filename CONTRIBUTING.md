# Contributing

Thank you for your interest in contributing to Plinto!

## Branch Naming Convention

We use **feature branching** with descriptive branch names following the format:

```
<tipo>/<descripción-corta>
```

### Branch Types

- `feature/` - New features or functionality
- `fix/` - Bug fixes
- `refactor/` - Code refactoring (no functional changes)
- `chore/` - Maintenance tasks (dependencies, config, etc.)
- `docs/` - Documentation updates
- `test/` - Test-related changes
- `style/` - Code style changes (formatting, whitespace, etc.)
- `perf/` - Performance improvements

### Examples

- `feature/auth-onboarding`
- `fix/session-refresh-issue`
- `refactor/tenant-guard`
- `chore/update-dependencies`
- `docs/api-documentation`

## Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/) specification.

### Format

```
<tipo>(<scope>): <descripción>

[opcional: cuerpo más detallado]

[opcional: footer con breaking changes o issue references]
```

### Commit Types

- `feat` - A new feature
- `fix` - A bug fix
- `refactor` - Code refactoring (no functional changes)
- `chore` - Maintenance tasks
- `docs` - Documentation changes
- `test` - Adding or updating tests
- `style` - Code style changes (formatting, whitespace)
- `perf` - Performance improvements
- `ci` - CI/CD changes
- `build` - Build system changes

### Scope

The scope should be the area of the codebase affected (e.g., `auth`, `tenants`, `api`, `web`).

### Examples

```bash
feat(auth): add OIDC login with session management
fix(session): handle expired refresh tokens correctly
refactor(tenants): simplify tenant selection logic
docs(readme): update setup instructions
test(auth): add integration tests for onboarding flow
chore(deps): update NestJS to latest version
```

### Best Practices

- Use imperative mood ("add" not "added" or "adds")
- Keep the subject line under 72 characters
- Capitalize the first letter of the subject
- Don't end the subject with a period
- Use the body to explain **what** and **why** vs. **how**
- Reference issues and pull requests in the footer

### Breaking Changes

If your commit introduces breaking changes, add `BREAKING CHANGE:` in the footer:

```
feat(api): change session endpoint response format

BREAKING CHANGE: Session endpoint now returns sessionId instead of session object
```

## Getting Started

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Make your changes
4. Commit your changes: `git commit -m "feat(scope): your message"`
5. Push to your fork: `git push origin feature/your-feature-name`
6. Open a Pull Request

## Questions?

If you have questions or want to discuss the roadmap, please open an [Issue](https://github.com/victorolave/plinto/issues).
