---
name: task-complete
description: Use when implementation is complete and you need to mark the task as COMPLETE for orchestrator handoff. Triggers on "complete", "finish", "done with task".
---

# Task Complete

## Overview

Mark task as COMPLETE to trigger orchestrator handoff to the next pipeline stage.

**Core principle:** Update progress status to COMPLETE → Orchestrator routes to next agent.

**Announce at start:** "I'm using the task-complete skill to complete this work."

## Multi-Agent Pipeline Integration

When working in a multi-agent pipeline (backend → qa → review-git):

1. **Agent completes work** → Calls task-complete
2. **task-complete** → Updates progress status to COMPLETE
3. **Orchestrator** → Detects COMPLETE on next loop
4. **Orchestrator** → Creates handoff document
5. **Orchestrator** → Enqueues task for next agent in pipeline

**Progress file location:** `state/progress/{TASK-ID}.md`

**Handoff file location:** `state/progress/HANDOFF_{TASK-ID}_{from}_to_{to}.md`

## The Process

### Update Progress Status to COMPLETE

**CRITICAL: Mark task as COMPLETE for orchestrator handoff.**

Update the progress file so the orchestrator can create handoffs:

```bash
# Update progress status to COMPLETE
# The orchestrator monitors progress files and triggers handoffs when status = COMPLETE
npx tsx -e "
import { updateProgressFile, STATUS_COMPLETE } from './lib/memory-manager.js';
updateProgressFile('agent-name', 'TASK-XXX', {
  status: STATUS_COMPLETE,  // Use constant for correctness
  log: 'Task completed successfully'
});
"
```

**IMPORTANT: Use `COMPLETE` NOT `COMPLETED`!**

The orchestrator checks for `=== 'COMPLETE'`. Using `COMPLETED` will cause the task to never be detected as complete.

**See:** `docs/status-reference.md` for complete status documentation.

**For multi-agent pipeline:** This signals the orchestrator to:
1. Create handoff document
2. Enqueue task for next agent in pipeline

## Integration

**Called by:**
- All handler skills (backend-handler, qa-handler, frontend-handler, review-git-handler)

**Pairs with:**
- **dev-docs** - Update progress.md before finishing

**Note:** Git operations (commit, push, PR) are handled exclusively by review-git-handler via git-decision and dev-git skills.
