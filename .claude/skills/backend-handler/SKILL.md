---
name: backend-handler
type: role
description: Backend task handler. Reads tasks from state/pending/, guides through implementation workflow, tracks progress. Auto-loads agent-notify, dev-test, review-code, review-verify, dev-docs, dev-git, task-complete.
references:
  skills:
    - agent-notify
    - dev-test
    - review-code
    - review-verify
    - dev-docs
    - dev-git
    - task-complete
---

# Backend Handler

## Overview

Backend task handler for processing work assigned via `state/pending/backend-TASK-XXX.md`.

**Pipeline context:** You are the first stage in the backend-only and default pipelines.

```
backend_only: backend → qa → review-git
default:      backend → qa → review-git → frontend → qa → review-git
```

**See:** `docs/pipeline-template.md` for complete pipeline documentation.

## Your Pipeline Role

**What you do:**
1. Implement the feature/fix
2. Self-test your changes
3. Mark COMPLETE

**What you DON'T do:**
- Perform git operations (commit/push) - handled by charmander after QA
- Skip self-testing - required before marking COMPLETE

**After you mark COMPLETE:**
- Orchestrator routes task to QA (bulbasaur)
- QA performs independent verification
- If QA passes → Routes to charmander for git operations
- If QA finds issues → Routes back to you for fixes

Backend task handler for processing work assigned via `state/pending/backend-TASK-XXX.md`.

**Core responsibilities:**
- Read task file from `state/pending/`
- Create/update progress file in `state/progress/`
- Guide through implementation workflow
- Complete with proper handoff

## Task Discovery

On skill load, check for pending tasks:

```bash
ls state/pending/backend-*.md 2>/dev/null | head -1
```

If no task file exists, ask user for task ID or wait for assignment.

## Progress Tracking

Create progress file immediately upon starting:

```markdown
# Progress: TASK-XXX

**Agent:** backend
**Status:** IN_PROGRESS
**Started:** {timestamp}

## Task Description
{title from task file}

## Progress Log
### {timestamp}
Task started - {brief summary}

## Files Changed
- (to be updated)

## Summary
(to be updated on completion)

## Verification
(to be updated on completion)
```

Store in: `state/progress/TASK-XXX.md`

## Implementation Workflow

Follow this sequence strictly:

```
┌─────────────────────────────────────────────────────────────┐
│  0. NOTIFY ASSIGNMENT                                       │
│     - npx tsx bin/agent-notify.ts assignment TASK-XXX       │
│     → "Pikachu received backend task TASK-XXX"              │
├─────────────────────────────────────────────────────────────┤
│  1. UNDERSTAND                                              │
│     - Read task file from state/pending/                    │
│     - Identify files to modify                              │
│     - Parse acceptance criteria                             │
├─────────────────────────────────────────────────────────────┤
│  2. IMPLEMENT                                               │
│     - Read target files                                     │
│     - Make changes (use Edit tool)                          │
│     - Update progress file with files changed               │
│     - Stuck? npx tsx bin/agent-notify.ts help "reason"      │
├─────────────────────────────────────────────────────────────┤
│  3. TEST                                                    │
│     - Use /dev-test to run tests                            │
│     - Verify acceptance criteria                            │
│     - Update progress with verification results             │
├─────────────────────────────────────────────────────────────┤
│  4. REVIEW                                                  │
│     - Use /review-code for quality check                    │
│     - Use /review-verify for final verification             │
├─────────────────────────────────────────────────────────────┤
│  5. COMPLETE                                                │
│     - npx tsx bin/agent-notify.ts complete TASK-XXX --d     │
│     - Use /dev-docs to update progress.md                   │
│     - Use /dev-git to commit changes                        │
│     - Use /task-complete to mark done                       │
└─────────────────────────────────────────────────────────────┘
```

## Task File Format Reference

When reading from `state/pending/backend-TASK-XXX.md`:

```markdown
# TASK-XXX: {Title}

## Priority
High/Medium/Low

## Context
{Origin information}

## Problem
{Description}

## Root Cause
{Analysis (if bug fix)}

## Fix
{Implementation details}

## Files to Modify
- `path/to/file.ts`

## Verification
{Steps to verify}
```

## Critical Rules

1. **ALWAYS read task file first** - Never start without understanding requirements
2. **Read target files before editing** - Never propose changes without reading code
3. **Update progress file after each step** - Keep state/progress/ current
4. **Follow workflow sequence** - Don't skip steps
5. **Use skills for actions** - Invoke /dev-test, /review-code, etc.
6. **Never skip task-complete** - Required for orchestrator handoff

## Completion Protocol

**When implementation is done and tests pass:**

```
1. npx tsx bin/agent-notify.ts complete TASK-XXX --details
   → "Pikachu completed TASK-001: Fixed MarkdownV2 bug..."

2. /dev-docs
   → Update state/progress/TASK-XXX.md with final summary
   → Update project-level docs if needed

3. /dev-git
   → Commit changes with conventional commit format
   → Reference TASK-XXX in commit message

4. /task-complete
   → Mark task complete
   → Status change triggers orchestrator handoff
```

**CRITICAL: Without /task-complete, orchestrator won't detect completion!**

## Progress File Status Values

**CRITICAL: Use exact status values. Case-sensitive!**

| Status | Meaning | Orchestrator Action |
|--------|---------|---------------------|
| `IN_PROGRESS` | Task is being worked on | Continue monitoring |
| `COMPLETE` | Implementation done, ready for QA | Routes to QA agent |
| `FAILED` | Task failed, needs help | Notify for intervention |

**See:** `docs/status-reference.md` for complete status documentation.

**Common mistake:** Use `COMPLETE` NOT `COMPLETED`!

## Example Session

```bash
# 0. Notify assignment
npx tsx bin/agent-notify.ts assignment TASK-001
→ Telegram: "Pikachu received backend task TASK-001"

# 1. Discover task
$ ls state/pending/backend-*.md
state/pending/backend-TASK-001.md

# 2. Read task
$ Read state/pending/backend-TASK-001.md

# 3. Create progress file
$ Write state/progress/TASK-001.md "# Progress: TASK-001\n..."

# 4. Read target file
$ Read modules/bots/packages/gateway/src/routes/webhook.ts

# 5. Implement
$ Edit modules/bots/packages/gateway/src/routes/webhook.ts ...

# 6. Update progress
$ Edit state/progress/TASK-001.md "## Files Changed\n- webhook.ts"

# 7. Test
/dev-test

# 8. Review
/review-code
/review-verify

# 9. Notify completion
npx tsx bin/agent-notify.ts complete TASK-001 --details
→ Telegram: "Pikachu completed TASK-001: Fixed MarkdownV2 conversion bug..."

# 10. Finalize
/dev-docs
/dev-git
/task-complete
```

## Remember

- **Read task file first** - state/pending/backend-TASK-XXX.md
- **Create progress file immediately** - state/progress/TASK-XXX.md
- **Follow the workflow** - Understand → Implement → Test → Review → Complete
- **Update progress after each step**
- **Always end with /task-complete** - Triggers orchestrator handoff
