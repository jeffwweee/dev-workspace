---
name: project-session
description: "Main orchestrator for dev-workspace multi-session Claude Code workflows. Coordinates work across projects with lock management and task delegation. Use for starting work requiring lock management, coordinating multi-step workflows, managing complex changes across files, and delegating to other dev-workspace skills."
---

# Project Session

## Overview

Main orchestrator skill for multi-session Claude Code workflows. Ensures safe, traceable work through lock management, worktree isolation, and proper delegation to specialized skills.

## Prerequisites

Before using this skill:
1. Run `node bin/dw.js init` to create or resume a session
2. Run `node bin/dw.js add <project> --path <path>` to register the project (if not already registered)

## Usage Modes

### `--select` (Project Selection Mode)
Use this mode to choose which project to work on:
```
/skill project-session --select
```

When this flag is provided:
1. List all available sessions using `node bin/dw.js sessions`
2. Ask the user to resume an existing session or create new
3. If new, list projects and ask which to work on
4. Show session status and available tasks
5. Ask what the user wants to do next

### Default Mode (Auto-Resume)
Without flags, continue with the most recently active session.

## Multi-Session Workflow

### 1. Session Setup

```bash
# Show session picker (resume existing or create new)
node bin/dw.js init

# Or explicitly create new session
node bin/dw.js init --new

# Or resume specific session
node bin/dw.js resume SESS-XXX
```

### 2. Claim Task (Auto-Creates Worktree)

```bash
# Claim creates worktree in ~/worktrees/<project>/<task>/
node bin/dw.js claim --task V2-016

# Output:
# Lock acquired successfully. Working in ~/worktrees/tg-agent/V2-016
```

The worktree provides isolated working directory for the task.

### 3. Delegate to Specialized Skills

After claiming a task, delegate to appropriate skills:

| Skill | Use For |
|-------|---------|
| `project-planner` | Task management, tasks.json updates |
| `docs-creator` | progress.md, PROJECT_CONTEXT.md updates |
| `git-agent` | Git operations, commits, branching |
| `code-reviewer` | Code review, lint checks |
| `tester` | Running tests, verification, smoke tests |

### 4. Completion Gate Verification

Before releasing the lock, verify:

- Tests pass (or smoke tests work)
- Code runs without errors
- `progress.md` is updated
- Git checkpoint created (if applicable)

### 5. End Gate Actions

```bash
# Record completion with PR URL
node bin/dw.js record-result --task V2-016 --status passed --pr https://github.com/.../pull/42

# Release locks
node bin/dw.js release --all

# Optionally remove worktree (prompted automatically)
```

## Session Management Commands

| Command | Description |
|---------|-------------|
| `node bin/dw.js init` | Show session picker |
| `node bin/dw.js init --new` | Create new session |
| `node bin/dw.js resume <id>` | Resume specific session |
| `node bin/dw.js sessions` | List all sessions |
| `node bin/dw.js status` | Show current session details |
| `node bin/dw.js end <id>` | End a session |
| `node bin/dw.js activity` | Update session activity |

## Worktree Commands

| Command | Description |
|---------|-------------|
| `node bin/dw.js worktree list` | List all worktrees |
| `node bin/dw.js worktree create --project X --task Y` | Create worktree manually |
| `node bin/dw.js worktree remove --project X --task Y` | Remove worktree |

## Cleanup Commands

| Command | Description |
|---------|-------------|
| `node bin/dw.js cleanup` | Clean expired sessions and locks |
| `node bin/dw.js cleanup --prune` | Also remove orphaned worktrees |
| `node bin/dw.js cleanup --dry-run` | Preview cleanup actions |

## Return Contract

See [return-contract.md](../references/return-contract.md).

## Safety Rules

1. **NEVER write code directly** - Always delegate to specialized skills
2. **ALWAYS claim locks first** - Use `node bin/dw.js claim --task <id>` before any work
3. **ALWAYS verify before completion** - Tests must pass before marking complete
4. **ALWAYS update progress.md** - Document what was done
5. **NEVER bypass safety gates** - Follow Start, Completion, and End gates

See [safety-rules.md](../references/safety-rules.md#coordination-operations) for patterns.

## Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| `DW_LOCKED` | Resource already locked | Wait or contact lock owner |
| `DW_NO_SESSION` | No active session | Run `node bin/dw.js init` |
| `DW_NO_PROJECT` | Project not found | Run `node bin/dw.js add` first |
| `DW_INVALID_TASK` | Task ID not found | Check tasks.json |
| `DW_SESSION_NOT_FOUND` | Session doesn't exist | Run `node bin/dw.js sessions` |
| `DW_WORKTREE_FAILED` | Worktree creation failed | Check git status |

## Example: Multi-Session Workflow

```
# Terminal 1 - Working on task V2-016
node bin/dw.js init --new
node bin/dw.js claim --task V2-016
# Working in ~/worktrees/tg-agent/V2-016

# Terminal 2 - Working on task V2-014 (parallel)
node bin/dw.js init --new
node bin/dw.js claim --task V2-014
# Working in ~/worktrees/tg-agent/V2-014

# Check all sessions
node bin/dw.js sessions
# Shows both sessions with their tasks and worktrees
```

## Example: Task Completion

```
User: /skill project-session --select

1. Show sessions:
   node bin/dw.js sessions

2. User selects or creates session

3. Claim task:
   node bin/dw.js claim --task V2-016
   # Auto-creates worktree

4. Work in worktree:
   cd ~/worktrees/tg-agent/V2-016

5. Delegate implementation:
   /skill tester --verify
   /skill docs-creator --update-progress

6. Completion:
   node bin/dw.js record-result --task V2-016 --status passed --pr https://github.com/.../pull/42
   # Prompted to remove worktree

7. Release:
   node bin/dw.js release --all

Status: SUCCESS

Summary:
- Implemented OAuth2 authentication feature
- Created worktree for isolated development
- PR created for code review

Files changed:
- src/auth/oauth.ts
- tests/auth/oauth.test.ts

Worktree:
- ~/worktrees/tg-agent/V2-016 (removed after PR)

Next recommended:
- Create PR session for merge management
```
