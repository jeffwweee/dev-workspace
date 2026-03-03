# Safety Gates

## Overview

Three safety gates ensure safe, controlled, and traceable operations in the dev-workspace. Each gate MUST be passed before proceeding to the next phase.

---

## Gate 1: Start Gate

**Purpose:** Ensure correct context and authorization before any work begins.

**Checks:**

### 1.1 Correct Project
- [ ] `node bin/dw.js status` shows the intended active project
- [ ] `node bin/dw.js switch <project>` has been run if needed
- [ ] Project path exists and is accessible

**Failure:** Run `node bin/dw.js switch <project>` first.

### 1.2 Lock Claimed
- [ ] `node bin/dw.js claim --task <task_id>` has been run
- [ ] `node bin/dw.js status` shows the lock is active
- [ ] Lock TTL is sufficient (> 30 minutes remaining)

**Failure:** Run `node bin/dw.js claim --task <task_id>` first.

**Error Code:** `DW_LOCKED` if resource already locked by another session.

### 1.3 Context Loaded
- [ ] Project context is reviewed (PROJECT_CONTEXT.md)
- [ ] Current progress is understood (progress.md)
- [ ] Task requirements are clear (tasks.json)

**Failure:** Read project files first or ask for clarification.

---

## Gate 2: Completion Gate

**Purpose:** Ensure work is actually complete before marking it done.

**Checks:**

### 2.1 Verification Run
- [ ] Tests pass (or smoke tests work)
- [ ] Code runs without errors
- [ ] Edge cases are tested

**Failure:** Run `/skill tester --verify` before proceeding.

### 2.2 Progress Updated
- [ ] `progress.md` updated with what was done
- [ ] Session log section has timestamp and summary
- [ ] Any issues or blockers are documented

**Failure:** Run `/skill docs-creator --update-progress` first.

### 2.3 Git Checkpoint (if applicable)
- [ ] Changes are committed
- [ ] Commit message follows project conventions
- [ ] Branch is clean (no uncommitted changes)

**Failure:** Run `/skill git-agent --commit` first.

---

## Gate 3: End Gate

**Purpose:** Ensure proper cleanup and audit trail before releasing lock.

**Checks:**

### 3.1 Progress Logged
- [ ] `node bin/dw.js record-result` run with appropriate status
- [ ] Status is correct: passed, failed, partial, or blocked
- [ ] Files changed are listed
- [ ] Summary is provided

**Failure:** Run `node bin/dw.js record-result --task <id> --status <status> --files <files> --summary <text>`

### 3.2 Tasks Updated
- [ ] `tasks.json` updated with task status
- [ ] `passes=true` set if and only if task is complete
- [ ] Dependent tasks are unblocked (if applicable)

**Failure:** Run `/skill project-planner --update-task` first.

### 3.3 Lock Released
- [ ] `node bin/dw.js release --all` run
- [ ] `node bin/dw.js status` shows no active locks for session

**Failure:** Run `node bin/dw.js release --all`

### 3.4 Audit Logged
- [ ] All events are in `state/audit.log`
- [ ] Timestamp is recorded
- [ ] Session ID is associated

**Auto:** The CLI handles this automatically.

---

## Gate Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     START GATE                              │
│  ✓ Correct project                                          │
│  ✓ Lock claimed                                             │
│  ✓ Context loaded                                           │
└──────────────────────┬──────────────────────────────────────┘
                       │ PASSED
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    DELEGATE TO SKILL                         │
│  (Implementation work happens here)                         │
└──────────────────────┬──────────────────────────────────────┘
                       │ Returns
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   COMPLETION GATE                            │
│  ✓ Verification run                                         │
│  ✓ Progress updated                                         │
│  ✓ Git checkpoint                                           │
└──────────────────────┬──────────────────────────────────────┘
                       │ PASSED
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                      END GATE                                │
│  ✓ Progress logged via node bin/dw.js record-result         │
│  ✓ Tasks updated                                            │
│  ✓ Lock released                                            │
│  ✓ Audit logged                                             │
└──────────────────────┬──────────────────────────────────────┘
                       │ COMPLETE
                       ▼
                    (Task Done)
```

---

## Bypassing Gates

**DO NOT bypass safety gates.**

If a gate seems unnecessary, document why and get user confirmation. The gates exist to prevent:
- Lost work (no progress/log)
- Conflicting changes (no locks)
- Broken states (no verification)
- Lost traceability (no audit)

---

## Error Codes Reference

| Code | Meaning | Action |
|------|---------|--------|
| `DW_LOCKED` | Resource already locked | Wait or contact lock owner |
| `DW_NO_PROJECT` | Project not found | Run `node bin/dw.js add` first |
| `DW_INVALID_TASK` | Task ID not found | Check `tasks.json` |
| `DW_NOT_OWNER` | Cannot release other's lock | Use correct session |
| `DW_NO_SESSION` | No active session | Run `node bin/dw.js init` first |
| `DW_MISSING_PATH` | Project path required | Add `--path` flag |
| `DW_CORRUPT_STATE` | JSON parse/write error | Check state files |

---

## Quick Reference

**Before starting work:**
```bash
node bin/dw.js init
node bin/dw.js switch <project>
node bin/dw.js claim --task TASK-001
```

**Before releasing lock:**
```bash
# Verify work is complete
node bin/dw.js record-result --task TASK-001 --status passed --files "src/main.ts" --summary "Implemented feature"
node bin/dw.js release --all
```

**Check status:**
```bash
node bin/dw.js status          # Session, locks, projects
node bin/dw.js queue           # Task queue
node bin/dw.js list-projects   # All projects
```
