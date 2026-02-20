# Orchestrator Policy

## Overview

The Orchestrator is responsible for coordinating multi-session Claude Code workflows across multiple projects. It ensures safe, traceable, and controlled code changes through strict delegation patterns.

## Core Rules

### 1. NEVER Write Code Directly

The Orchestrator MUST NOT:
- Write code files directly
- Edit files without delegation
- Make implementation decisions without claiming locks

The Orchestrator MUST:
- Claim appropriate locks before ANY work
- Delegate to specialized skills for implementation
- Verify results before marking tasks complete

### 2. ALWAYS Claim Locks First

Before delegating to ANY skill:
1. Run `node bin/dw.js claim --project <id>` or `node bin/dw.js claim --task <task_id>`
2. Verify lock was acquired (check status)
3. Only then delegate to the appropriate skill

Lock acquisition order:
```bash
node bin/dw.js init                    # Create session
node bin/dw.js switch <project>        # Set active project
node bin/dw.js claim --task TASK-001   # Claim specific task
<delegate to skill>
node bin/dw.js release --all           # Release when done
```

### 3. Update Progress Before Releasing

Before releasing ANY lock:
1. Verify the work is complete (tests pass, code works)
2. Update `progress.md` with what was done
3. Update `tasks.json` to mark task complete
4. Only THEN release the lock

### 4. Verification Before Completion

NEVER mark a task as `passed=true` until:
- All code changes are implemented
- Tests pass (or smoke tests work)
- Documentation is updated
- Git checkpoint is created (if applicable)

## Delegation Patterns

### Pattern 1: New Feature

```
1. node bin/dw.js claim --task TASK-001
2. /skill project-planner --task TASK-001 --plan
3. /skill git-agent --checkout-branch
4. /skill <implementation> --execute
5. /skill tester --verify
6. node bin/dw.js record-result --task TASK-001 --status passed
7. node bin/dw.js release --all
```

### Pattern 2: Bug Fix

```
1. node bin/dw.js claim --task TASK-002
2. /skill git-agent --status
3. /skill tester --reproduce
4. <delegate to appropriate skill>
5. /skill tester --verify-fix
6. node bin/dw.js record-result --task TASK-002 --status passed
7. node bin/dw.js release --all
```

### Pattern 3: Code Review

```
1. node bin/dw.js claim --task TASK-003
2. /skill code-reviewer --review <files>
3. /skill docs-creator --update-findings
4. node bin/dw.js record-result --task TASK-003 --status passed
5. node bin/dw.js release --all
```

## Skill Responsibilities

| Skill | Responsibility |
|-------|---------------|
| `project-session` | Main orchestrator loop |
| `project-planner` | Task management, tasks.json |
| `docs-creator` | progress.md, PROJECT_CONTEXT.md |
| `git-agent` | Git operations, commits |
| `code-reviewer` | Code review, lint |
| `tester` | Tests, verification |

## Return Contract

ALL skills MUST return in this format:

```
Status: SUCCESS|FAILURE|PARTIAL|BLOCKED
Summary:
- <bullet points of what was done>

Files changed:
- <file paths>

Commands run:
- <commands executed>

Evidence:
- <proof of working>

Next recommended:
- <single next action or "none">
```

## Error Handling

If a skill returns FAILURE:
1. Check the Summary for what went wrong
2. Check Evidence for error details
3. Either retry or escalate to user
4. Update progress.md with failure details

If a skill returns BLOCKED:
1. Check what's blocking
2. Resolve blocker or delegate to appropriate skill
3. Resume when unblocked

## Audit Trail

EVERY action must be logged:
- Lock claims/releases via CLI
- Work completed via `node bin/dw.js record-result`
- All events go to `state/audit.log`

NEVER bypass the audit trail.
