# Contributing

Thank you for your interest in contributing to Plinto!

## Git Workflow: Feature Branch Strategy

We use a **feature branch workflow** to manage development. This strategy ensures that the `main` branch always contains stable, production-ready code, while new features and changes are developed in isolated branches.

### Overview

The feature branch workflow follows these principles:

1. **`main` branch is always deployable** - The main branch should always be in a stable state
2. **One feature per branch** - Each branch should focus on a single feature, fix, or change
3. **Isolated development** - Work happens in feature branches, keeping main clean
4. **Code review required** - All changes are merged via Pull Requests with review

### Workflow Steps

#### 1. Start from an Updated Main Branch

Always start your feature branch from the latest `main`:

```bash
# Ensure you're on main
git checkout main

# Pull the latest changes
git pull origin main
```

#### 2. Create a Feature Branch

Create a new branch following the [Branch Naming Convention](#branch-naming-convention):

```bash
# Create and switch to new branch
git checkout -b feature/auth-onboarding

# Or using the shorthand
git checkout -b fix/session-refresh-issue
```

#### 3. Develop Your Feature

Make your changes, commit frequently with clear messages:

```bash
# Make changes to files
# ...

# Stage changes
git add .

# Commit with conventional commit message
git commit -m "feat(auth): add OIDC login implementation"
```

#### 4. Keep Your Branch Updated

Regularly sync your feature branch with `main` to avoid conflicts:

```bash
# While on your feature branch
git checkout feature/auth-onboarding

# Fetch latest changes
git fetch origin

# Merge main into your branch
git merge origin/main

# Or use rebase (if you prefer linear history)
git rebase origin/main
```

**Note:** If you've already pushed your branch, use `git merge` to avoid rewriting shared history. Use `rebase` only if you're the only one working on the branch.

#### 5. Push Your Branch

Push your feature branch to the remote repository:

```bash
# First push (sets upstream)
git push -u origin feature/auth-onboarding

# Subsequent pushes
git push
```

#### 6. Create a Pull Request

1. Go to the repository on GitHub
2. Click "New Pull Request"
3. Select your feature branch as the source and `main` as the target
4. **Fill out the PR template** - GitHub will automatically load our PR template (`.github/pull_request_template.md`)
5. Complete all relevant sections:
   - Description of changes
   - Type of change
   - Related specs/PRDs
   - Testing notes
   - Checklist items
   - Screenshots (if applicable)
   - Related issues

See [Pull Request Guidelines](#pull-request-guidelines) for detailed information about creating effective PRs.

#### 7. Code Review and Feedback

- Address review comments by making additional commits to your branch
- Keep the PR updated if `main` changes during review
- Respond to feedback and update the PR as needed

#### 8. Merge to Main

Once approved, the PR will be merged to `main`. After merge:

```bash
# Switch back to main
git checkout main

# Pull the merged changes
git pull origin main

# Delete your local feature branch (optional cleanup)
git branch -d feature/auth-onboarding

# Delete remote branch (if not auto-deleted)
git push origin --delete feature/auth-onboarding
```

### Branch Naming Convention

We use **feature branching** with descriptive branch names following the format:

```
<tipo>/<descripción-corta>
```

#### Branch Types

- `feature/` - New features or functionality
- `fix/` - Bug fixes
- `refactor/` - Code refactoring (no functional changes)
- `chore/` - Maintenance tasks (dependencies, config, etc.)
- `docs/` - Documentation updates
- `test/` - Test-related changes
- `style/` - Code style changes (formatting, whitespace, etc.)
- `perf/` - Performance improvements

#### Examples

- `feature/auth-onboarding`
- `fix/session-refresh-issue`
- `refactor/tenant-guard`
- `chore/update-dependencies`
- `docs/api-documentation`

### Best Practices

1. **Keep branches focused** - One feature or fix per branch
2. **Keep branches short-lived** - Merge frequently to avoid large conflicts
3. **Sync regularly** - Update your branch with `main` at least daily
4. **Write clear commit messages** - Follow [Conventional Commits](#commit-message-convention)
5. **Test before PR** - Ensure your code passes tests and linting
6. **Small PRs** - Prefer multiple small PRs over one large PR
7. **Clean up** - Delete merged branches to keep the repository tidy

### Handling Conflicts

If conflicts arise when merging `main` into your branch:

```bash
# Merge main into your branch
git merge origin/main

# Git will indicate conflicted files
# Edit the files to resolve conflicts
# Look for conflict markers: <<<<<<<, =======, >>>>>>>

# After resolving conflicts
git add <resolved-files>
git commit -m "fix: resolve merge conflicts with main"
```

## Pull Request Guidelines

We use a **Pull Request template** to ensure consistent and complete PR descriptions. When you create a PR, GitHub will automatically load the template from `.github/pull_request_template.md`.

### PR Template Structure

Our PR template includes the following sections:

1. **Description** - Clear explanation of what the PR does
2. **Type of Change** - Categorize your PR (feature, fix, refactor, etc.)
3. **Related Spec/PRD** - Link to related specifications or PRDs
4. **Changes Made** - List of main changes
5. **Testing** - Testing approach and scenarios covered
6. **Checklist** - Code quality, functionality, documentation, and security checks
7. **Screenshots / Demo** - Visual evidence of changes (if applicable)
8. **Breaking Changes** - Document any breaking changes
9. **Related Issues** - Link to related issues using keywords
10. **Additional Notes** - Any extra context for reviewers

### Filling Out the PR Template

#### Description
Provide a clear, concise summary of what this PR accomplishes. Think of it as the "elevator pitch" for your changes.

**Good example:**
```
Implements OIDC authentication flow with session management. Users can now sign in via external identity provider, complete onboarding, and access the application with proper tenant context.
```

**Bad example:**
```
Fixes stuff
```

#### Type of Change
Select the appropriate type. This helps categorize and track changes:
- 🎉 **Feature** - New functionality
- 🐛 **Bug fix** - Fixes an issue
- ♻️ **Refactor** - Code restructuring
- 📝 **Documentation** - Docs only
- 🧪 **Test** - Test additions/updates
- And others as listed in the template

#### Related Spec/PRD
If your PR implements a feature from a spec or PRD, link to it:
- **Spec**: `specs/001-auth-registration-onboarding/`
- **PRD**: `docs/prd/PRD-001-authentication-registration-tenant-onboarding.md`
- **ADR**: `docs/adr/0003-oidc-agnostic-auth-cookie-sessions-multitenancy.md`

#### Changes Made
List the main changes in bullet points:
- Implemented OIDC login flow with PKCE
- Added session management with JWT tokens
- Created tenant selection UI for multi-tenant users
- Added onboarding flow for first-time users

#### Testing
Describe your testing approach:
- **Unit tests**: List what you tested at the unit level
- **Integration tests**: Describe integration test coverage
- **Manual testing**: Explain what you manually verified
- **Test scenarios**: List specific scenarios covered

**Example:**
```
- [x] Unit tests added for session manager
- [x] Integration tests for OIDC callback flow
- [x] Manual testing of complete onboarding flow
- [x] All existing tests pass

Test Scenarios:
1. New user completes onboarding successfully
2. Returning user with single tenant auto-selects
3. Returning user with multiple tenants sees selection page
```

#### Checklist
Complete all relevant checklist items. This helps ensure code quality:
- ✅ Code follows style guidelines
- ✅ Self-review completed
- ✅ Linting passes
- ✅ Feature works as expected
- ✅ Documentation updated

#### Screenshots / Demo
For UI changes, include before/after screenshots or a demo. This helps reviewers understand visual changes quickly.

#### Breaking Changes
If your PR introduces breaking changes:
- Mark the checkbox
- Clearly describe what breaks and how to migrate

**Example:**
```
BREAKING CHANGE: Session endpoint now returns sessionId instead of session object. Clients must update to use the new response format.
```

#### Related Issues
Use GitHub keywords to link issues:
- `Closes #123` - Closes the issue when PR is merged
- `Fixes #456` - Fixes the issue
- `Related to #789` - Related but doesn't close

### PR Best Practices

1. **Keep PRs focused** - One feature or fix per PR
2. **Keep PRs small** - Easier to review and merge
3. **Write clear descriptions** - Help reviewers understand context
4. **Complete the checklist** - Ensure quality before requesting review
5. **Link related work** - Connect to specs, PRDs, and issues
6. **Update documentation** - Keep docs in sync with code changes
7. **Test thoroughly** - Ensure all tests pass before submitting
8. **Respond to feedback** - Address review comments promptly

### PR Review Process

1. **Self-review first** - Review your own code before requesting review
2. **Ensure checklist is complete** - Don't request review until ready
3. **Wait for approval** - At least one approval required before merge
4. **Address feedback** - Make requested changes and update the PR
5. **Keep PR updated** - Sync with `main` if it changes during review
6. **Squash commits** (optional) - Clean up commit history before merge

### Example PR

Based on the last merged PR (`feature/auth-onboarding`), here's an example of a well-structured PR:

**Title**: `feat(auth): implement OIDC authentication and tenant onboarding`

**Description**:
```
Implements complete authentication flow with OIDC provider integration, user onboarding, and tenant management. This PR completes PRD-001 and all related specifications.
```

**Type**: 🎉 Feature

**Related Spec/PRD**:
- Spec: `specs/001-auth-registration-onboarding/`
- PRD: `docs/prd/PRD-001-authentication-registration-tenant-onboarding.md`

**Changes Made**:
- OIDC login flow with Authorization Code + PKCE
- JIT user provisioning on first login
- Onboarding flow with profile and tenant creation
- Session management with JWT tokens
- Tenant selection for multi-tenant users
- Session refresh mechanism

**Testing**:
- [x] Unit tests for auth modules
- [x] Integration tests for OIDC callback
- [x] Manual testing of all user stories
- [x] All existing tests pass

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

1. **Fork the repository** (if contributing from outside the organization)
2. **Clone your fork** (or the main repository if you have direct access):
   ```bash
   git clone https://github.com/victorolave/plinto.git
   cd plinto
   ```
3. **Set up your environment** - Follow the setup instructions in the project README
4. **Create a feature branch** - See [Git Workflow](#git-workflow-feature-branch-strategy) for details:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/your-feature-name
   ```
5. **Make your changes** - Write code, add tests, update documentation
6. **Commit your changes** - Follow [Conventional Commits](#commit-message-convention):
   ```bash
   git add .
   git commit -m "feat(scope): your descriptive message"
   ```
7. **Keep your branch updated** - Regularly sync with main:
   ```bash
   git fetch origin
   git merge origin/main
   ```
8. **Push your branch**:
   ```bash
   git push -u origin feature/your-feature-name
   ```
9. **Open a Pull Request** - Create a PR on GitHub targeting the `main` branch

## Questions?

If you have questions or want to discuss the roadmap, please open an [Issue](https://github.com/victorolave/plinto/issues).
