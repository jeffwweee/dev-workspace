---
name: git-agent
description: "Git operations for dev-workspace projects. Handles branching, committing, status checks, and repository management with conventional commit format. Use for creating a new feature branch, committing changes, checking repository status, merging or rebasing branches, and creating git checkpoints before releasing locks."
---

# Git Agent

## Overview

Handles all git operations including branching, committing, status checks, and repository management.

## Commands

### Checkout Branch

Checkout existing branch or create new branch:

```bash
/git-agent --checkout-branch --create feature/login
```

### Status Check

Show git status including staged, unstaged, and untracked files:

```bash
/git-agent --status
```

### Commit Changes

Commit staged changes with generated or provided message:

```bash
/git-agent --commit --message "feat: Add user authentication"
```

### Create Checkpoint

Create a checkpoint commit for current state:

```bash
/git-agent --checkpoint
```

### Show Diff

Show diff of changes (staged or unstaged):

```bash
/git-agent --diff --staged
```

### Merge Branch

Merge specified branch into current branch:

```bash
/git-agent --merge feature/login
```

## Commit Message Format

See [conventions.md](../references/conventions.md#conventional-commits) for complete conventional commits reference.

| Type | Description | Example |
|------|-------------|---------|
| `feat:` | New feature | `feat: Add user authentication` |
| `fix:` | Bug fix | `fix: Handle null pointer in login` |
| `docs:` | Documentation only | `docs: Update README with setup` |
| `refactor:` | Code refactoring | `refactor: Extract auth to module` |
| `test:` | Adding or updating tests | `test: Add integration tests for login` |
| `chore:` | Maintenance tasks | `chore: Update dependencies` |

## Branch Naming

See [conventions.md](../references/conventions.md#branch-naming) for complete branch naming conventions.

## Checkpoint Format

See [conventions.md](../references/conventions.md#checkpoint-commit-format) for checkpoint commit format.

## Return Contract

See [return-contract.md](../references/return-contract.md).

## Safety Rules

1. **ALWAYS check git status** - Before destructive operations
2. **NEVER force push** - Without explicit user request
3. **ALWAYS create backup branches** - Before major changes
4. **NEVER commit sensitive data** - No keys, passwords, tokens
5. **ALWAYS verify commits** - Before pushing

See [safety-rules.md](../references/safety-rules.md#destructive-operations) for patterns.

## Error Handling

- **If not a git repository**: Run `git init` if appropriate, or notify user to initialize
- **If merge conflicts**: Report conflicting files, provide resolution steps, do not auto-resolve
- **If commit fails**: Check for merge conflicts, check for pre-commit hook failures, report specific error

See [error-handling.md](../references/error-handling.md) for patterns.

## Example

```
User: /git-agent --commit --message "feat: Add user login"

Status: SUCCESS

Summary:
- Staged all changes (3 files)
- Created commit with conventional format
- Working tree is now clean

Files changed:
- src/auth/login.ts
- src/auth/oauth.ts
- tests/auth/login.test.ts

Commands run:
- git status
- git add .
- git commit -m "feat: Add user login"

Evidence:
- Commit: a1b2c3d4e5f6 (feat: Add user login)
- Branch: feature/login
- Status: clean (no uncommitted changes)

Next recommended:
- node bin/dw.js record-result --task TASK-001 --status passed
```
