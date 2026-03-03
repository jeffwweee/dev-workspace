# Plan: Automated Plan Execution for Agent Pipeline

**Created:** 2026-03-02
**Issue:** `/plan-execute` requires human feedback between batches, blocking automated pipeline

## Problem Analysis

The current `plan-execute` skill is designed for human-in-the-loop:
- Step 3: "Ready for feedback."
- Step 4: "Based on feedback: Apply changes if needed, Execute next batch"

When used in the agent pipeline, the backend agent waits indefinitely for feedback that never comes.

## Proposed Solution

Add an `--auto` flag to `plan-execute` that:
1. Skips the "wait for feedback" step
2. Auto-continues through all batches
3. Only stops for actual blockers (test failures, missing dependencies)

## Tasks

### Task 1: Update SKILL.md with --auto flag documentation
- [ ] Add `--auto` flag to Usage section
- [ ] Document auto mode behavior
- [ ] Define when auto mode stops (blockers only)

### Task 2: Modify execution flow for auto mode
- [ ] In Step 3 (Report): Add conditional - if auto mode, skip "Ready for feedback"
- [ ] In Step 4 (Continue): Add conditional - if auto mode, auto-continue to next batch
- [ ] Add loop to execute all batches sequentially

### Task 3: Update orchestrator to use --auto flag
- [ ] Modify `lib/orchestrator.ts` to inject `/plan-execute --auto --plan <path>`
- [ ] Test with automated pipeline

### Task 4: Test automated flow
- [ ] Submit a test task with --auto
- [ ] Verify agent completes all batches without waiting
- [ ] Verify completion notification is sent

## Auto Mode Behavior

```
Load plan
    ↓
Execute batch 1
    ↓
[Auto-continue - no wait]
    ↓
Execute batch 2
    ↓
[Auto-continue - no wait]
    ↓
...
    ↓
All tasks complete
    ↓
review-verify (auto)
    ↓
task-complete (auto)
    ↓
Notify orchestrator
```

## Stopping Conditions (even in auto mode)

- Test/verification fails 3 times
- Missing dependency cannot be resolved
- Plan instruction is ambiguous
- Git conflict or merge issue

## Files to Modify

1. `.claude/skills/plan-execute/SKILL.md` - Add auto mode documentation
2. `lib/orchestrator.ts` - Add --auto flag to injection command

## Verification

```bash
# Submit task with auto mode
npx tsx bin/cc-orch.ts submit TEST-004 -p docs/plans/test-plan.md

# Should complete all tasks without human input
# Check progress file for completion
cat state/progress/TEST-004.md
```
