---
name: project-session
description: "Main orchestrator for dev-workspace multi-session Claude Code workflows. Coordinates work across projects with lock management and task delegation. Use for starting work requiring lock management, coordinating multi-step workflows, managing complex changes across files, and delegating to other dev-workspace skills."
---

# Project Session

## Overview

Main orchestrator skill for multi-session Claude Code workflows. Ensures safe, traceable work through lock management and proper delegation to specialized skills.

## Prerequisites

Before using this skill:
1. Run `node bin/dw.js init` to create a session
2. Run `node bin/dw.js add <project> --path <path>` to register the project
3. Run `node bin/dw.js switch <project>` to set the active project

## Workflow

### 1. Start Gate Verification

Verify these conditions before proceeding:

```bash
# Check session exists and is active
node bin/dw.js status

# Switch to correct project if needed
node bin/dw.js switch <project-name>

# Claim lock on the task
node bin/dw.js claim --task <TASK-ID>
```

### 2. Delegate to Specialized Skills

After claiming a lock, delegate to appropriate skills:

| Skill | Use For |
|-------|---------|
| `project-planner` | Task management, tasks.json updates |
| `docs-creator` | progress.md, PROJECT_CONTEXT.md updates |
| `git-agent` | Git operations, commits, branching |
| `code-reviewer` | Code review, lint checks |
| `tester` | Running tests, verification, smoke tests |

### 3. Completion Gate Verification

Before releasing the lock, verify:

- Tests pass (or smoke tests work)
- Code runs without errors
- `progress.md` is updated
- Git checkpoint created (if applicable)

### 4. End Gate Actions

```bash
# Record completion
node bin/dw.js record-result --task <TASK-ID> --status passed --files <files> --summary "<summary>"

# Release lock
node bin/dw.js release --all
```

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

See [dw-cli-reference.md](../references/dw-cli-reference.md#error-codes) for complete error code reference.

| Code | Meaning | Action |
|------|---------|--------|
| `DW_LOCKED` | Resource already locked | Wait or contact lock owner |
| `DW_NO_SESSION` | No active session | Run `node bin/dw.js init` |
| `DW_NO_PROJECT` | Project not found | Run `node bin/dw.js add` first |
| `DW_INVALID_TASK` | Task ID not found | Check tasks.json |

## Example

```
User: /skill project-session --task TASK-001

1. Start Gate:
   node bin/dw.js status shows active session
   node bin/dw.js switch myproject
   node bin/dw.js claim --task TASK-001

2. Delegation:
   /skill project-planner --task TASK-001 --plan
   /skill git-agent --checkout-branch feature/TASK-001
   [implementation work]
   /skill tester --verify
   /skill docs-creator --update-progress

3. Completion Gate:
   Tests passing (42/42)
   progress.md updated
   Git commit created

4. End Gate:
   node bin/dw.js record-result --task TASK-001 --status passed
   node bin/dw.js release --all

Status: SUCCESS

Summary:
- Implemented user authentication feature
- Added OAuth2 providers (Google, GitHub)
- Created tests (all passing)

Files changed:
- src/auth/oauth.ts
- src/auth/providers/google.ts
- src/auth/providers/github.ts
- tests/auth/oauth.test.ts

Commands run:
- node bin/dw.js claim --task TASK-001
- npm test
- git add .
- git commit -m "feat: Add OAuth2 authentication"
- node bin/dw.js record-result --task TASK-001 --status passed
- node bin/dw.js release --all

Evidence:
- All tests passing (42/42)
- Manual login test successful
- Coverage: 89%

Next recommended:
- node bin/dw.js pick-next
```
