# Progress Status Values

**Version:** 1.0
**Last Updated:** 2026-03-02

## Valid Status Values

These are the ONLY valid status values for progress files. Case-sensitive!

| Status | Value | Used By | Orchestrator Action |
|--------|-------|---------|---------------------|
| IN_PROGRESS | `IN_PROGRESS` | All agents starting work | Continue monitoring |
| COMPLETE | `COMPLETE` | All agents when done | Route to next agent OR close pipeline |
| ISSUES_FOUND | `ISSUES_FOUND` | QA agent when defects found | Route back to previous agent |
| FAILED | `FAILED` | Any agent on failure | Notify for intervention, stop pipeline |
| BLOCKED | `BLOCKED` | Any agent when blocked | Log blockage, wait for intervention |

## How to Use

### When starting a task:

```markdown
# Progress: TASK-XXX

**Agent:** backend
**Status:** IN_PROGRESS
**Started:** 2026-03-02T10:00:00.000Z

## Task Description
{task description}
```

### When completing work (developers):

```bash
# Option 1: Using updateProgressFile
npx tsx -e "
import { updateProgressFile } from './lib/memory-manager.js';
updateProgressFile('backend', 'TASK-001', { status: 'COMPLETE' });
"

# Option 2: Direct edit
Edit state/progress/TASK-001.md
Change: **Status:** IN_PROGRESS → **Status:** COMPLETE
```

### When QA finds issues:

```bash
# Option 1: Using updateProgressFile
npx tsx -e "
import { updateProgressFile } from './lib/memory-manager.js';
updateProgressFile('qa', 'TASK-001', { status: 'ISSUES_FOUND' });
"

# Option 2: Direct edit
Edit state/progress/TASK-001.md
Change: **Status:** IN_PROGRESS → **Status:** ISSUES_FOUND
```

### When task fails:

```bash
Edit state/progress/TASK-001.md
**Status:** FAILED

## Error
{error details}
```

## Common Mistakes

### ❌ WRONG: Using "COMPLETED"
```markdown
**Status:** COMPLETED  ← WRONG! Orchestrator won't detect completion
```

### ✅ CORRECT: Using "COMPLETE"
```markdown
**Status:** COMPLETE  ← Correct!
```

### ❌ WRONG: Using "Done", "Finished", etc.
```markdown
**Status:** DONE  ← Not recognized!
```

### ✅ CORRECT: Using valid values only
```markdown
**Status:** COMPLETE  ← Good
**Status:** ISSUES_FOUND  ← Good
**Status:** FAILED  ← Good
```

## Orchestrator Behavior

```typescript
// What orchestrator checks for:
if (progress.status === 'COMPLETE') {
  // Route to next agent or close pipeline
}
if (progress.status === 'ISSUES_FOUND') {
  // Route back to previous agent for revision
}
if (progress.status === 'FAILED') {
  // Notify for intervention
}
if (progress.status === 'BLOCKED') {
  // Log and wait
}
```

## Quick Reference

**For Developers (backend/frontend):**
- Start: `IN_PROGRESS`
- After impl + test: `COMPLETE`
- Don't use git operations yourself!

**For QA:**
- Start: `IN_PROGRESS`
- After review + test: `COMPLETE` (pass) or `ISSUES_FOUND` (fail)

**For Review-Git (charmander):**
- After git decision: `COMPLETE`
- Use `COMPLETE` NOT `COMPLETED`!

## Code Reference

```typescript
// Import constants
import {
  STATUS_IN_PROGRESS,
  STATUS_COMPLETE,
  STATUS_ISSUES_FOUND,
  STATUS_FAILED,
  STATUS_BLOCKED,
  isValidStatus
} from './lib/status-constants.js';

// Validate before setting
if (isValidStatus(newStatus)) {
  updateProgressFile(agent, taskId, { status: newStatus });
} else {
  console.error('Invalid status:', newStatus);
}
```

## File Locations

- **Status constants:** `lib/status-constants.ts`
- **Progress files:** `state/progress/TASK-XXX.md`
- **Memory manager:** `lib/memory-manager.ts`
- **Orchestrator:** `lib/orchestrator.ts`

## Testing Status

To test if orchestrator detects your status change:

```bash
# 1. Update status
Edit state/progress/TASK-001.md "**Status:** COMPLETE"

# 2. Check orchestrator status
npx tsx bin/cc-orch.ts status

# 3. Watch logs for routing
# Orchestrator should show: "Queued TASK-XXX for {next_agent}"
```

## Remember

- **Case matters!** `COMPLETE` ≠ `complete` ≠ `Completed`
- **Use exact values** - No variations
- **Test after changing** - Verify orchestrator detects the change
