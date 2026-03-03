---
name: plan-execute
description: Use when you have a written implementation plan to execute in a separate session with review checkpoints. Triggers on "execute plan", "run plan", "implement plan", "follow plan".
---

# Plan Execute

## Overview

Load plan, review critically, execute tasks in batches, report for review between batches.

**Core principle:** Batch execution with checkpoints for architect review.

**Announce at start:** "I'm using the plan-execute skill to implement this plan."

## Usage

```bash
# Execute specific plan file
/plan-execute --plan docs/plans/2026-02-24-feature.md

# Execute plan linked to task (reads plan path from task)
/plan-execute --task TASK-001

# Auto mode: Execute without waiting for feedback (for automated pipelines)
/plan-execute --auto --plan docs/plans/2026-02-24-feature.md
/plan-execute --auto --task TASK-001
```

## Flags

- `--plan <path>` - Path to plan file
- `--task <id>` - Task ID (reads plan path from task registry)
- `--auto` - Automated mode: skip feedback checkpoints, continue through all batches
- `--handoff <path>` - Path to handoff document (alternative to plan)

## Notification Protocol

When executing a task with `chat_id` in context, send Telegram notifications at lifecycle events:

### Events

| Event | When | Format |
|-------|------|--------|
| START | Task begins | `▶ Starting {taskId}...` |
| PROGRESS | Batch complete | `✓ Batch {n}/{total}: {summary}` |
| BLOCKED | Cannot proceed | `⚠ BLOCKED: {reason}` |
| COMPLETE | All done | `✅ {taskId} complete!` |

### How to Notify

Use `/telegram-reply` with task's chat_id:

```bash
/telegram-reply --chat-id {chatId} --text "▶ Starting TASK-001..."
```

### In Auto Mode

- Send START notification when plan execution begins
- Send PROGRESS after each batch
- Send COMPLETE when all tasks done
- Send BLOCKED if stopping due to unresolvable issue

## Context: Dev-Workspace Integration

This skill integrates with dev-workspace session management:

**Before starting:**
```bash
# Ensure you have an active session
node bin/dw.js status

# If no session, create one
node bin/dw.js init --new

# Claim the task (creates worktree)
node bin/dw.js claim --task TASK-XXX
```

**Working directory:** Plans execute in worktrees at `~/worktrees/<project>/<task>/`

## The Process

### Step 1: Load and Review Plan

1. Read plan file from `docs/plans/YYYY-MM-DD-<feature-name>.md`
2. Review critically - identify any questions or concerns about the plan
3. If concerns:
   - **Normal mode:** Raise them with your human partner before starting
   - **Auto mode:** Log concerns and proceed if resolvable, stop if critical blocker
4. If no concerns: Create task list and proceed

### Step 2: Execute Batch

**Default: First 3 tasks**

For each task:
1. Mark as in_progress (via TaskUpdate or TodoWrite)
2. Follow each step exactly (plan has bite-sized steps)
3. Run verifications as specified
4. Mark as completed

### Step 3: Report

When batch complete:
- Show what was implemented
- Show verification output

**Mode-specific behavior:**
- **Normal mode:** Say "Ready for feedback." and wait
- **Auto mode:** Skip waiting, immediately proceed to Step 4

### Step 4: Continue

**Normal mode:** Based on feedback:
- Apply changes if needed
- Execute next batch
- Repeat until complete

**Auto mode:** Automatically:
- Execute next batch immediately
- Repeat until all tasks complete
- Only stop for blockers (test failures, missing deps, ambiguous instructions)

### Step 5: Complete Development

After all tasks complete and verified:

1. **Run verification** using `review-verify` skill
2. **Update progress** via `dev-docs` skill
3. **Finish branch** using `task-complete` skill

## When to Stop and Ask for Help

**STOP executing immediately when:**
- Hit a blocker mid-batch (missing dependency, test fails, instruction unclear)
- Plan has critical gaps preventing starting
- You don't understand an instruction
- Verification fails repeatedly (3+ attempts)

**Auto mode additional stopping conditions:**
- Test/verification fails 3 times consecutively
- Missing dependency cannot be auto-resolved
- Plan instruction is ambiguous and cannot be interpreted confidently
- Git conflict or merge issue detected

**Ask for clarification rather than guessing.**

## When to Revisit Earlier Steps

**Return to Review (Step 1) when:**
- Partner updates the plan based on your feedback
- Fundamental approach needs rethinking

**Don't force through blockers** - stop and ask.

## Dev-Workspace Session Flow

**Normal mode (with checkpoints):**
```
node bin/dw.js claim --task TASK-XXX
    ↓
Worktree created at ~/worktrees/<project>/TASK-XXX
    ↓
Load plan from docs/plans/
    ↓
Execute batch of tasks (3 at a time)
    ↓
Report for review
    ↓
Wait for feedback
    ↓
Continue until complete
    ↓
review-verify
    ↓
dev-docs (update progress.md)
    ↓
task-complete
    ↓
node bin/dw.js release --all
```

**Auto mode (no checkpoints):**
```
Load plan from docs/plans/
    ↓
Send START notification
    ↓
Execute batch 1 (3 tasks)
    ↓
Send PROGRESS notification
    ↓
[Auto-continue - no wait]
    ↓
Execute batch 2 (next 3 tasks)
    ↓
Send PROGRESS notification
    ↓
[Auto-continue - no wait]
    ↓
... repeat until all tasks complete ...
    ↓
review-verify (auto)
    ↓
task-complete (auto)
    ↓
Send COMPLETE notification
    ↓
Notify orchestrator via state/progress/
```

## Remember

- Review plan critically first
- Follow plan steps exactly
- Don't skip verifications
- Reference skills when plan says to
- Between batches: just report and wait
- Stop when blocked, don't guess
- Never start implementation on main/master branch without explicit user consent

## Integration

**Meta-skill:**
- **using-skills** - Invoke BEFORE any response to check for applicable skills

**Required workflow skills:**
- **plan-create** - Creates the plan this skill executes
- **task-complete** - Complete development after all tasks
- **review-verify** - Verify before claiming done

**Orchestration:**
- **task-register** - For managing task status
- **dev-test** - For running verification commands


## Alternative: plan-parallel

If you want same-session execution with fresh subagents per task:
- Use `plan-parallel` skill instead
- Better for independent tasks with fast iteration
- This skill (plan-execute) is for batch execution with human checkpoints
