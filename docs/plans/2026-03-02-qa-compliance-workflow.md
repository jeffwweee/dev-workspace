# Plan: Add QA Compliance Step to Workflow

**Date:** 2026-03-02
**Status:** Draft

## Problem

Currently, developers mark tasks complete directly after implementation + tests. There's no final QA compliance check before git operations.

## Proposed Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                    CURRENT WORKFLOW                              │
├─────────────────────────────────────────────────────────────────┤
│  Developer (backend/frontend)                                    │
│    ↓                                                             │
│  Implementation + Tests                                          │
│    ↓                                                             │
│  Mark COMPLETE                                                   │
│    ↓                                                             │
│  Orchestrator → Next agent or done                               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    NEW WORKFLOW                                  │
├─────────────────────────────────────────────────────────────────┤
│  Developer (backend/frontend)                                    │
│    ↓                                                             │
│  Implementation + Tests                                          │
│    ↓                                                             │
│  Mark COMPLETE → Orchestrator                                     │
│    ↓                                                             │
│  QA (bulbasaur) - Spec compliance check                          │
│    ↓                                                             │
│  QA Mark COMPLETE → Orchestrator                                 │
│    ↓                                                             │
│  Charmander (review-git) - Results + changelog notification      │
│    ↓                                                             │
│  "Commit and push?" (ask user)                                   │
│    ↓                                                             │
│  Git operations (commit/push/PR)                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Changes Required

### 1. Update Workflow Configuration

**File:** `config/orchestration.yml`

**Current:**
```yaml
workflows:
  default:
    pipeline: [backend, review-git, frontend, review-git, qa]
```

**New:**
```yaml
workflows:
  default:
    pipeline: [backend, qa, review-git, frontend, qa, review-git]
    # Developer → QA check → Git ops → Frontend → QA → Git ops
```

### 2. Update Orchestrator Logic

**File:** `lib/orchestrator.ts`

Add new handler for QA→charmander transition:

```typescript
async function handleTaskComplete(taskId: string, taskInfo: { agent: string; workflow?: string }): Promise<void> {
  // ... existing logic ...

  // Special case: QA complete → notify charmander
  if (taskInfo.agent === 'qa' && nextAgent === 'review-git') {
    await notifyCharmanderForGitOps(taskId, taskInfo);
    // Don't auto-advance - wait for user confirmation
    return;
  }
}

async function notifyCharmanderForGitOps(taskId: string, taskInfo: any): Promise<void> {
  // 1. Read progress file for results/changelog
  const progress = readProgressFile('qa', taskId);

  // 2. Format message with:
  //    - QA results (pass/fail)
  //    - Files changed
  //    - Changelog summary
  //    - Suggested commit message

  // 3. Send via charmander bot
  const charmanderBot = getBotByRole('review-git');
  const adminChat = charmanderBot?.permissions?.admin_users?.[0];

  // 4. Ask: "Commit and push?"
}
```

### 3. Update Handler Skills

**Files to update:**
- `.claude/skills/backend-handler/SKILL.md`
- `.claude/skills/frontend-handler/SKILL.md`
- `.claude/skills/qa-handler/SKILL.md`

**Change:** Remove git operations from developer handlers. They now:
1. Implement + test
2. Mark COMPLETE (auto-routes to QA)

**QA handler** adds new completion mode:
- After QA pass, mark COMPLETE → Routes to charmander

### 4. Add Git Decision Handler

**New skill:** `.claude/skills/git-decision/SKILL.md`

Charmander uses this to:
1. Present QA results + changelog
2. Suggest conventional commit message
3. Ask user: "Commit and push?"
4. If yes → perform git operations
5. Mark COMPLETE → advances pipeline

## Decision Points

### Q: Should developers run tests before marking COMPLETE?

**A: Yes.** Workflow ensures:
1. Developer runs tests (`/dev-test`) - self-verification
2. QA runs tests again - independent verification
3. This catches "it works on my machine" issues

### Q: What if QA fails?

**A: Two options:**
1. **ISSUES_FOUND** status - Routes back to developer
2. **FAILED** status - Stops pipeline, notifies for human intervention

### Q: Who creates the commit message?

**A: Charmander (review-git)** generates it based on:
- Task ID
- QA summary
- Files changed
- Conventional commit format

User can edit before confirming.

## Implementation Checklist

- [ ] Update `config/orchestration.yml` pipeline
- [ ] Add `notifyCharmanderForGitOps` to `lib/orchestrator.ts`
- [ ] Update `backend-handler` skill (remove git ops)
- [ ] Update `frontend-handler` skill (remove git ops)
- [ ] Update `qa-handler` skill (add charmander handoff)
- [ ] Create `git-decision` skill for charmander
- [ ] Test full pipeline flow

## Decisions Made

1. **QA required for all changes** - No skipping, ensures consistent quality
2. **Separate pipelines maintained** - backend-only and frontend-only workflows remain separate

## Updated Workflow Configuration

```yaml
workflows:
  backend_only:
    pipeline: [backend, qa, review-git]
    # Developer → QA → Git ops

  frontend_only:
    pipeline: [frontend, qa, review-git]
    # Developer → QA → Git ops

  default:
    pipeline: [backend, qa, review-git, frontend, qa, review-git]
    # Full stack: Backend → QA → Git → Frontend → QA → Git
```
