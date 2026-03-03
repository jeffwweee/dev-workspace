# Multi-Agent Pipeline Template

**Version:** 2.0
**Last Updated:** 2026-03-02

## Overview

This document defines the standard multi-agent pipeline workflow. All agents must follow this template.

## Pipeline Workflows

### Available Workflows

| Workflow | Pipeline | Use Case |
|----------|----------|----------|
| `backend_only` | backend → qa → review-git | Backend-only changes |
| `frontend_only` | frontend → qa → review-git | Frontend-only changes |
| `default` | backend → qa → review-git → frontend → qa → review-git | Full-stack features |

### Pipeline Stages

```
┌─────────────────────────────────────────────────────────────────┐
│  DEVELOPER (backend/frontend)                                   │
│  1. Receive task from queue                                     │
│  2. Read task file from state/pending/{role}-TASK-XXX.md        │
│  3. Notify assignment via agent-notify                          │
│  4. Implement + test                                            │
│  5. Mark COMPLETE                                               │
│    ↓                                                            │
│  Orchestrator detects COMPLETE → Routes to QA                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  QA (bulbasaur)                                                 │
│  1. Receive handoff from developer                              │
│  2. Read handoff + task files                                   │
│  3. Notify assignment via agent-notify                          │
│  4. Review code for quality/security                            │
│  5. Run tests                                                   │
│  6. Verify requirements                                         │
│  7. Mark COMPLETE or ISSUES_FOUND                               │
│    ↓                                                            │
│  Orchestrator detects COMPLETE → Notifies charmander            │
│  Orchestrator detects ISSUES_FOUND → Routes back to developer   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  CHARMANDER (review-git) - Git Decision                         │
│  1. Receive notification from orchestrator (via charmander bot) │
│  2. Present: QA results + files + suggested commit              │
│  3. Ask user: "Commit and push?"                                │
│  4. Handle user response (yes/no/edit)                          │
│  5. If yes: Stage → Commit → Push                               │
│  6. Notify completion via agent-notify                          │
│  7. Mark COMPLETE                                               │
│    ↓                                                            │
│  Orchestrator detects COMPLETE → Advances or closes pipeline    │
└─────────────────────────────────────────────────────────────────┘
```

## Agent Responsibilities

### Developer Agents (backend/frontend)

**Entry Point:** Task file in `state/pending/{role}-TASK-XXX.md`

**Workflow:**
1. **Notify assignment** - `npx tsx bin/agent-notify.ts assignment TASK-XXX`
2. **Understand** - Read task file, identify files to modify
3. **Implement** - Read files, make changes, update progress
4. **Self-test** - Run tests, verify locally
5. **Mark COMPLETE** - Update progress status to COMPLETE

**Do NOT:**
- Perform git operations (commit/push)
- Skip self-testing

**Progress file:** `state/progress/TASK-XXX.md`

**Completion:** Mark status = COMPLETE → Auto-routes to QA

### QA Agent (bulbasaur)

**Entry Point:** Handoff from `state/progress/HANDOFF_TASK-XXX_{dev}_to_qa.md`

**Workflow:**
1. **Notify assignment** - `npx tsx bin/agent-notify.ts assignment TASK-XXX`
2. **Understand** - Read handoff + task files
3. **Review code** - Check security, bugs, style
4. **Run tests** - Independent test verification
5. **Verify requirements** - Validate acceptance criteria
6. **Decide:**
   - **Pass:** Mark COMPLETE → Routes to charmander
   - **Issues:** Mark ISSUES_FOUND → Routes back to developer

**Progress file:** `state/progress/TASK-XXX.md` (same as developer)

**Completion:**
- COMPLETE → Routes to charmander (git decision)
- ISSUES_FOUND → Routes back to developer

### Review-Git Agent (charmander)

**Entry Point:** Notification from orchestrator (via charmander bot)

**Workflow:**
1. **Receive notification** - From orchestrator via charmander bot
2. **Present results** - QA results + files + suggested commit
3. **Ask user** - "Commit and push?"
4. **Handle response:**
   - **Yes:** Stage files → Commit → Push
   - **No:** Ask what to do instead
   - **Edit:** Get custom commit, then proceed
5. **Notify completion** - `npx tsx bin/agent-notify.ts complete TASK-XXX --details`
6. **Mark COMPLETE** - Pipeline advances or closes

**Special:** Unlike other agents, charmander waits for user input before proceeding.

## File Locations

| File Type | Location | Purpose |
|-----------|----------|---------|
| Task file | `state/pending/{role}-TASK-XXX.md` | Initial task definition |
| Progress | `state/progress/TASK-XXX.md` | Shared progress tracking |
| Handoff | `state/progress/HANDOFF_TASK-XXX_{from}_to_{to}.md` | Agent handoff document |
| Agent memory | `state/memory/{agent}.md` | Agent-specific memory |

## Status Values

| Status | Used By | Meaning | Next Action |
|--------|---------|---------|-------------|
| IN_PROGRESS | All | Task is being worked on | Continue work |
| COMPLETE | All | Work done, ready for next stage | Orchestrator routes to next agent |
| ISSUES_FOUND | QA | Defects found, needs revision | Routes back to developer |
| FAILED | Any | Task failed, needs intervention | Notify for help |
| PENDING_DECISION | review-git | Awaiting user "commit" decision | Wait for user response |

## Orchestrator Behavior

The orchestrator (`cc-orch`) monitors progress files and routes tasks:

```typescript
// Pseudocode
for (const [taskId, taskInfo] of activeTasks) {
  const progress = readProgressFile(taskInfo.agent, taskId);

  if (progress.status === 'COMPLETE') {
    const workflow = getWorkflow(taskInfo.workflow);
    const currentIndex = workflow.pipeline.indexOf(taskInfo.agent);
    const nextAgent = workflow.pipeline[currentIndex + 1];

    if (taskInfo.agent === 'qa' && nextAgent === 'review-git') {
      // Special: Notify charmander for git decision
      notifyCharmanderForGitOps(taskId, progress);
    } else if (nextAgent) {
      // Standard: Create handoff, route to next agent
      createHandoff(taskId, taskInfo.agent, nextAgent);
      enqueueTask(nextAgent, taskId);
    } else {
      // End of pipeline: Task complete!
      notifyTaskComplete(taskId);
    }
  }
}
```

## Communication Flow

```
User (via Telegram)
    ↓
Pichu (orchestrator/commander)
    ↓
cc-orch creates task file
    ↓
Task queued for first agent
    ↓
Developer (pikachu/raichu)
    ↓
[Implementation + tests]
    ↓
QA (bulbasaur)
    ↓
[Code review + test verification]
    ↓
Charmander (review-git)
    ↓
[Git operations: commit/push]
    ↓
User notified of completion
```

## Quick Reference for Agents

### When I receive a task:

1. **Notify:** `npx tsx bin/agent-notify.ts assignment TASK-XXX`
2. **Read:** `state/pending/{my-role}-TASK-XXX.md`
3. **Create progress:** `state/progress/TASK-XXX.md`
4. **Do the work** (implementation/review/tests)
5. **Update progress** with findings/results

### When I'm done:

1. **Developers:** Mark COMPLETE → Auto-routes to QA
2. **QA:** Mark COMPLETE (pass) or ISSUES_FOUND (fail)
3. **Charmander:** Get user confirmation → Commit → Mark COMPLETE

### NEVER:

- Skip self-testing (developers)
- Commit/push without QA approval (developers)
- Mark COMPLETE without verification (qa)
- Auto-commit without user confirmation (charmander)

## Role Skill Mappings

| Agent | Bot | Role Skill | Handler Skill |
|-------|-----|------------|---------------|
| orchestrator | pichu | orchestrator-developer | commander |
| backend | pikachu | backend-developer | backend-handler |
| frontend | raichu | frontend-developer | frontend-handler |
| qa | bulbasaur | qa-developer | qa-handler |
| review-git | charmander | review-git-developer | review-git-handler |

**Note:** Role skills provide domain knowledge. Handler skills provide workflow templates.
