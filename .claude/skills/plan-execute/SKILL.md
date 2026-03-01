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
```

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
3. If concerns: Raise them with your human partner before starting
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
- Say: "Ready for feedback."

### Step 4: Continue

Based on feedback:
- Apply changes if needed
- Execute next batch
- Repeat until complete

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
- Verification fails repeatedly

**Ask for clarification rather than guessing.**

## When to Revisit Earlier Steps

**Return to Review (Step 1) when:**
- Partner updates the plan based on your feedback
- Fundamental approach needs rethinking

**Don't force through blockers** - stop and ask.

## Dev-Workspace Session Flow

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

## Remember

- Review plan critically first
- Follow plan steps exactly
- Don't skip verifications
- Reference skills when plan says to
- Between batches: just report and wait
- Stop when blocked, don't guess
- Never start implementation on main/master branch without explicit user consent

## Integration

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
