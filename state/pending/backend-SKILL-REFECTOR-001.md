# SKILL-REFACTOR-001: Handler Skills Git Separation

## Priority
High

## Context
From pichu orchestrator session (chat 195061634)

## Problem
The current skill architecture has git operations duplicated across multiple agents:

1. `task-complete` skill includes full git workflow (verify tests, determine base branch, commit, push, PR)
2. `backend-handler`, `qa-handler`, `frontend-handler` all include `/dev-git` in their completion workflow
3. There's a dedicated `review-git-developer` role with `git-decision` skill specifically for git operations

This creates redundancy where:
- backend does: impl -> test -> dev-git -> task-complete (with more git)
- qa does: review -> test -> dev-git -> task-complete (with more git)
- review-git does: git-decision -> commit -> push

The pipeline should be: impl -> qa -> git (only review-git does git)

## Root Cause
Skills were designed for standalone use but now conflict with the multi-agent pipeline where git should only be handled by review-git agent.

## Fix

### 1. Refactor `task-complete` skill
Strip down to ONLY:
- Update progress status to COMPLETE
- Trigger orchestrator handoff

Remove:
- Step 1: Verify tests (moved to dev-test)
- Step 2: Determine base branch
- Step 4: Execute choice (merge, PR, etc.)
- Step 6: Cleanup worktree

Keep only:
- Step 5: Update progress status to COMPLETE

### 2. Update `backend-handler` skill
Remove from completion workflow:
- `/dev-git` invocation

New workflow:
```
UNDERSTAND -> IMPLEMENT -> TEST -> REVIEW
    -> agent-notify complete
    -> dev-docs
    -> task-complete (status=COMPLETE only)
    -> [orchestrator routes to QA]
```

Remove from references/skills array:
- `dev-git`

### 3. Update `qa-handler` skill
Remove from completion workflow:
- `/dev-git` invocation

New workflow:
```
REVIEW CODE -> RUN TESTS -> VERIFY
    -> agent-notify complete
    -> dev-docs
    -> task-complete (status=COMPLETE only)
    -> [orchestrator routes to review-git]
```

Remove from references/skills array:
- `dev-git`

### 4. Update `frontend-handler` skill
Same changes as backend-handler.

### 5. Keep `review-git-handler` unchanged
This remains the ONLY agent that does git operations via:
- `/git-decision` for user confirmation
- `/dev-git` for commit/push operations

## Files to Modify
- `.claude/skills/task-complete/SKILL.md`
- `.claude/skills/backend-handler/SKILL.md`
- `.claude/skills/qa-handler/SKILL.md`
- `.claude/skills/frontend-handler/SKILL.md`
- `.claude/skills/review-git-handler/SKILL.md` (verify no changes needed)

## Verification
1. Review each modified skill file
2. Confirm git operations only in review-git-handler
3. Confirm task-complete only updates status
4. Test with a sample pipeline run

## Expected Outcome
Clean pipeline separation:
```
backend (impl only) -> qa (verify only) -> review-git (git only)
```

Each agent has a single responsibility:
- backend/frontend: implement and test
- qa: verify and approve
- review-git: commit and push
