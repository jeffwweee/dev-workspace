---
name: executing-plans
description: Use when you have a written implementation plan to execute in a separate session with review checkpoints
---

# Executing Plans

## Overview

Load plan, review critically, execute tasks in batches, report for review between batches.

**Core principle:** Batch execution with checkpoints for architect review.

**Announce at start:** "I'm using the executing-plans skill to implement this plan."

## Evolution Integration

During plan execution, emit signals for evolution tracking:

### Task Start
```bash
node -e "require('./lib/evolution-session.cjs').emitSignal(process.env.CLAUDE_SESSION_ID || 'local', 'pattern', {task: '<task-id>', action: 'start'}).then(() => process.exit(0))" 2>/dev/null || true
```

### Task Completion
```bash
node -e "require('./lib/evolution-session.cjs').emitSignal(process.env.CLAUDE_SESSION_ID || 'local', 'completion', {task: '<task-id>', success: true}).then(() => process.exit(0))" 2>/dev/null || true
```

### Error Recovery
```bash
node -e "require('./lib/evolution-session.cjs').emitSignal(process.env.CLAUDE_SESSION_ID || 'local', 'repair', {error: '<error-type>', fix: '<fix-applied>', success: true}).then(() => process.exit(0))" 2>/dev/null || true
```

These signals are non-blocking and fail silently if Redis unavailable.

## Usage

```bash
# Execute specific plan file
/executing-plans --plan docs/plans/2026-02-24-feature.md

# Execute plan linked to task (reads plan path from task)
/executing-plans --task TASK-001
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

1. **Run verification** using `verification-before-completion` skill
2. **Update progress** via `docs-creator` skill
3. **Finish branch** using `finishing-a-development-branch` skill

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
verification-before-completion
    ↓
docs-creator (update progress.md)
    ↓
finishing-a-development-branch
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
- **using-git-worktrees** - Worktrees created via `node bin/dw.js claim`
- **writing-plans** - Creates the plan this skill executes
- **finishing-a-development-branch** - Complete development after all tasks
- **verification-before-completion** - Verify before claiming done

**Orchestration:**
- **project-session** - Can delegate to this skill for plan execution
- **tester** - For running verification commands

## Alternative: Subagent-Driven

If you want same-session execution with fresh subagents per task:
- Use `subagent-driven-development` skill instead
- Better for independent tasks with fast iteration
- This skill (executing-plans) is for batch execution with human checkpoints
