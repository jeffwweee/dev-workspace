# Skills and Pipeline Review - Summary

**Date:** 2026-03-02
**Status:** Complete

## Changes Made

### 1. Created Pipeline Template
**File:** `docs/pipeline-template.md`

- Defines standard multi-agent pipeline workflow
- Documents all three workflows: backend_only, frontend_only, default
- Explains agent responsibilities and orchestrator behavior
- Provides quick reference for all agents

### 2. Fixed Commander Skill
**File:** `.claude/skills/commander/SKILL.md`

- Added `type: role` metadata
- Added `references.skills` section
- Added pipeline routing documentation
- Added workflow options (backend_only, frontend_only, default)
- References pipeline template

### 3. Updated Orchestrator-Developer Skill
**File:** `.claude/skills/orchestrator-developer/SKILL.md`

- Added pipeline overview section
- Added workflow monitoring explanation
- Added agent notification flow
- Added QA→git decision flow documentation
- References pipeline template

### 4. Created Review-Git-Developer Role Skill
**File:** `.claude/skills/review-git-developer/SKILL.md`

- New role skill for charmander (was using qa-developer)
- Covers code review + git operations
- Explains QA→git decision workflow
- Includes confidence scoring and git decision handling

### 5. Updated Orchestrator Config
**File:** `config/orchestration.yml`

- Changed charmander's role_skill from `qa-developer` to `review-git-developer`
- Updated pipelines to include QA before review-git:
  - `backend_only`: backend → qa → review-git
  - `frontend_only`: frontend → qa → review-git
  - `default`: backend → qa → review-git → frontend → qa → review-git

### 6. Updated Handler Skills

Added pipeline context to all handler skills:

**Backend-Handler** (`backend-handler/SKILL.md`):
- First stage in backend-only and default pipelines
- Implements + self-tests
- Marks COMPLETE → Routes to QA

**Frontend-Handler** (`frontend-handler/SKILL.md`):
- First stage in frontend-only, fourth in default
- Implements UI + tests
- Marks COMPLETE → Routes to QA

**QA-Handler** (`qa-handler/SKILL.md`):
- Second stage in all pipelines (between dev and git)
- Reviews code + runs independent tests
- Decides: COMPLETE (pass) → charmander, or ISSUES_FOUND → back to dev

**Review-Git-Handler** (`review-git-handler/SKILL.md`):
- Final stage in all pipelines
- Receives QA results, asks user "Commit and push?"
- Handles git operations after confirmation

## Pipeline Reference

```
┌─────────────────────────────────────────────────────────────────┐
│                    PIPELINE WORKFLOW                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  backend_only:                                                  │
│    backend (pikachu)                                            │
│      ↓ [implement + test, mark COMPLETE]                        │
│    qa (bulbasaur)                                               │
│      ↓ [review + test, mark COMPLETE or ISSUES_FOUND]           │
│    review-git (charmander)                                      │
│      ↓ [present results, ask user, commit/push]                 │
│    DONE                                                         │
│                                                                 │
│  frontend_only:                                                 │
│    frontend (raichu)                                            │
│      ↓ [implement + test, mark COMPLETE]                        │
│    qa (bulbasaur)                                               │
│      ↓ [review + test, mark COMPLETE or ISSUES_FOUND]           │
│    review-git (charmander)                                      │
│      ↓ [present results, ask user, commit/push]                 │
│    DONE                                                         │
│                                                                 │
│  default (full-stack):                                          │
│    backend → qa → review-git → frontend → qa → review-git       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Role Skill Mappings

| Agent | Bot | Role Skill | Handler Skill | Stage |
|-------|-----|------------|---------------|-------|
| orchestrator | pichu | orchestrator-developer | commander | Entry/routing |
| backend | pikachu | backend-developer | backend-handler | Dev |
| frontend | raichu | frontend-developer | frontend-handler | Dev |
| qa | bulbasaur | qa-developer | qa-handler | QA |
| review-git | charmander | review-git-developer | review-git-handler | Git |

## Key Files

| File | Purpose |
|------|---------|
| `docs/pipeline-template.md` | Master pipeline documentation |
| `config/orchestration.yml` | Pipeline and bot configuration |
| `lib/orchestrator.ts` | Pipeline routing logic |
| `lib/pipeline-router.ts` | Pipeline advancement |

## Agent Quick Reference

### When I receive a task:

1. **Notify assignment:** `npx tsx bin/agent-notify.ts assignment TASK-XXX`
2. **Read task file:** `state/pending/{my-role}-TASK-XXX.md`
3. **Create progress:** `state/progress/TASK-XXX.md`
4. **Do the work**
5. **Update progress**

### When I'm done:

- **Developers:** Mark COMPLETE → Auto-routes to QA
- **QA:** Mark COMPLETE (to charmander) or ISSUES_FOUND (back to dev)
- **Charmander:** Get user confirmation → Commit/push → Mark COMPLETE

## Communication Flow

```
User → Pichu (commander) → cc-orch → Task Queue
                                          ↓
                                    Developer (pikachu/raichu)
                                          ↓
                                    QA (bulbasaur)
                                          ↓
                              Charmander (git decision)
                                          ↓
                                    User notified
```

Each agent notifies via their own bot:
- pikachu_cc_bot (backend)
- raichu_cc_bot (frontend)
- bulbasaur_cc_bot (qa)
- charmander_cc_bot (review-git)
- pichu_cc_bot (orchestrator)

## Next Steps

1. **Test the pipeline** - Create a test task and verify flow
2. **Update agent memory files** - Ensure agents have pipeline context
3. **Monitor orchestrator** - Verify routing works correctly
4. **Adjust thresholds** - Tune confidence thresholds if needed
