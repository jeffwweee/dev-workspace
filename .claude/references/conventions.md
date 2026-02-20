# Conventions

Standard conventions used across dev-workspace projects.

## Conventional Commits

### Format

```
<type>: <subject>

<body - optional>

<footer - optional>
```

### Types

| Type | Description | Example |
|------|-------------|---------|
| `feat:` | New feature | `feat: Add user authentication` |
| `fix:` | Bug fix | `fix: Handle null pointer in login` |
| `docs:` | Documentation only | `docs: Update README with setup` |
| `refactor:` | Code refactoring | `refactor: Extract auth to module` |
| `test:` | Adding or updating tests | `test: Add integration tests for login` |
| `chore:` | Maintenance tasks | `chore: Update dependencies` |

### Full Example

```
feat: Add OAuth2 authentication

- Add Google OAuth provider
- Add GitHub OAuth provider
- Create session management
- Add tests for OAuth flow

Closes #123
```

## Branch Naming

| Prefix | Use For | Example |
|--------|---------|---------|
| `feature/` | New features | `feature/user-auth` |
| `fix/` | Bug fixes | `fix/login-crash` |
| `docs/` | Documentation | `docs/api-updates` |
| `refactor/` | Code refactoring | `refactor/auth-module` |
| `test/` | Test changes | `test/add-integration-tests` |
| `chore/` | Maintenance | `chore/update-deps` |

## Task Priority Levels

| Priority | Description | Use For |
|----------|-------------|---------|
| 1 | Critical | Blockers, security fixes |
| 2 | High | User-facing features |
| 3 | Medium | Internal improvements |
| 4 | Low | Nice-to-haves |
| 5 | Backlog | Future consideration |

## Task Status Values

| Status | Description |
|--------|-------------|
| `pending` | Not yet started |
| `in_progress` | Currently being worked on |
| `completed` | Successfully finished |
| `failed` | Could not complete |
| `blocked` | Waiting on dependency |

## Task Schema

```json
{
  "tasks": [
    {
      "id": "TASK-001",
      "title": "Task title",
      "description": "Detailed description",
      "priority": 1,
      "status": "pending",
      "passes": false,
      "dependsOn": [],
      "assignee": null,
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z",
      "tags": []
    }
  ]
}
```

## Timestamp Format

- **ISO 8601**: `YYYY-MM-DDTHH:MM:SSZ`
- **Display format**: `YYYY-MM-DD HH:MM UTC`

## File Naming

| Type | Convention | Example |
|------|------------|---------|
| Skills | `SKILL.md` | `code-reviewer/SKILL.md` |
| Policies | `UPPERCASE.md` | `SAFETY_GATES.md` |
| References | `kebab-case.md` | `return-contract.md` |
| Progress | `lowercase.md` | `progress.md` |
| Context | `UPPERCASE.md` | `PROJECT_CONTEXT.md` |

## Checkpoint Commit Format

```
checkpoint: <timestamp> - <task_id>

Work checkpoint before releasing lock.
```

Example:
```
checkpoint: 2024-01-15-10:30 - TASK-001

Checkpoint before releasing lock.
```
