---
name: git-decision
description: Git decision handler for review-git agent. Presents QA results, suggests commit message, and handles commit/push decisions.
references:
  skills: []
---

# Git Decision

## Overview

Used by charmander (review-git) after QA passes to present results and handle commit/push decision.

**When QA completes:**
1. Orchestrator creates handoff file with QA results
2. Orchestrator wakes up charmander via tmux injection: `/git-decision --task TASK-XXX --handoff /path/to/handoff.md`
3. Orchestrator sends notification via charmander bot to user
4. User sees: QA results + suggested commit + "Commit and push?"
5. User responds with decision
6. This skill handles the response

**Invocation:**
```
/git-decision --task TASK-XXX --handoff state/progress/HANDOFF_TASK-XXX_qa_to_review-git.md
```

## Trigger Detection

**When invoked by orchestrator:**

The orchestrator will invoke this skill with arguments:
```
/git-decision --task TASK-XXX --handoff state/progress/HANDOFF_TASK-XXX_qa_to_review-git.md
```

**First action: Read the handoff file**

```bash
# Read handoff file to get QA results
Read state/progress/HANDOFF_TASK-XXX_qa_to_review-git.md
```

The handoff file contains:
- Task summary
- Files changed
- QA test results
- Suggested commit message

**Or check for pending git decision manually:**

```bash
# Check for active task with PENDING_DECISION status
grep -r "PENDING_DECISION" state/progress/*.md 2>/dev/null
```

Or check orchestrator state:
```bash
npx tsx bin/cc-orch.ts status | grep git-decision
```

## Decision Workflow

```
┌─────────────────────────────────────────────────────────────┐
│  1. RECEIVE NOTIFICATION                                     │
│     - Orchestrator sends via charmander bot                 │
│     - Contains: QA results, files changed, summary          │
├─────────────────────────────────────────────────────────────┤
│  2. WAIT FOR USER RESPONSE                                  │
│     - User replies to Telegram message                      │
│     - Options: yes/no/edit details                          │
├─────────────────────────────────────────────────────────────┤
│  3. HANDLE RESPONSE                                         │
│     - YES: Proceed with git operations                      │
│     - NO: Ask what to do instead                            │
│     - EDIT: Get custom commit message                       │
├─────────────────────────────────────────────────────────────┤
│  4. PERFORM GIT OPERATIONS (if confirmed)                   │
│     - Stage files                                           │
│     - Create commit with message                            │
│     - Push to remote                                        │
│     - Optionally create PR                                  │
├─────────────────────────────────────────────────────────────┤
│  5. CLEANUP AND COMPLETE                                    │
│     - Remove PENDING_DECISION entry                         │
│     - Mark task COMPLETE                                    │
│     - Orchestrator advances pipeline                        │
└─────────────────────────────────────────────────────────────┘
```

## Notification Format

**Message from orchestrator:**
```
📊 QA Results for TASK-001

Status: ✅ PASSED

All 15 tests passed. No issues found.

Files changed:
  • modules/bots/packages/gateway/src/webhook.ts
  • modules/bots/packages/gateway/test/webhook.test.ts

Summary:
Fixed MarkdownV2 conversion bug in gateway webhook.

─────────────────────────────────────

Suggested commit:
`fix(gateway): default parse_mode to MarkdownV2`

Commit and push?
```

## User Responses

### Option 1: Yes - Proceed

**User says:** "yes", "y", "commit", "proceed"

**Actions:**
1. Read progress file for task ID
2. Extract files changed
3. Run git operations:
   ```bash
   git add <files>
   git commit -m "<commit message>"
   git push
   ```
4. Notify success via charmander bot
5. Mark task COMPLETE

### Option 2: No - Don't commit

**User says:** "no", "n", "skip", "not yet"

**Actions:**
1. Ask what to do instead:
   - "I'll handle it manually" - Mark complete, exit
   - "Edit the commit" - Go to Option 3
   - "Hold for now" - Keep pending, exit
2. Update decision status accordingly

### Option 3: Edit - Custom commit

**User says:** "edit", "change commit", provides custom message

**Actions:**
1. Use custom commit message
2. Confirm with user
3. Proceed with git operations

## Implementation Commands

### Check git status before committing:

```bash
git status
git diff --stat
```

### Stage and commit:

```bash
# Stage specific files
git add path/to/file1.ts path/to/file2.ts

# Or stage all changes
git add -A

# Commit with message
git commit -m "feat(scope): description

Additional context in body.

Closes TASK-XXX"
```

### Push:

```bash
git push
# Or for new branch
git push -u origin <branch>
```

### Optional: Create PR

```bash
gh pr create --title "feat(scope): description" \
  --body "## Summary
- Bullet point

## Test Plan
- [ ] Tests pass"
```

## Progress File Update

**Update BOTH progress files after commit:**

1. Main task progress file (`TASK-XXX.md`):

```markdown
## Git Operations

**Committed:** Yes
**Commit Hash:** abc123def456
**Branch:** feature/task-001
**Pushed:** Yes
**PR:** #42 (if created)
```

2. Git-decision progress file (`TASK-XXX-git-decision.md`) - **CRITICAL**:

```markdown
**Status:** COMPLETE
**Completed:** {timestamp}

## Summary
Git operations completed successfully.
- Commit: abc123def456
- Pushed: Yes
```

**The git-decision progress file MUST be marked COMPLETE for the orchestrator to detect completion.**

## Error Handling

**If git operations fail:**

1. Check for merge conflicts:
   ```bash
   git status
   ```
2. If conflicts, notify user:
   ```
   ❌ Git push failed: Merge conflicts

   Please resolve conflicts and retry.
   ```
3. If push rejected, notify user:
   ```
   ❌ Git push rejected: Remote has new commits

   Please pull and rebase.
   ```

## Example Session

```bash
# 1. Orchestrator wakes up charmander with handoff
# (via tmux injection)
/git-decision --task TASK-001 --handoff state/progress/HANDOFF_TASK-001_qa_to_review-git.md

# 2. Read handoff file to get QA results
$ Read state/progress/HANDOFF_TASK-001_qa_to_review-git.md
→ Extract summary, files changed, test results, suggested commit

# 3. Orchestrator sends notification to user via Telegram
# (This happens automatically, user sees the message)

# 4. Wait for user response
# User replies: "yes"

# 5. Check git status
$ git status
→ Shows modified files

# 6. Stage files
$ git add modules/bots/packages/gateway/src/webhook.ts
$ git add modules/bots/packages/gateway/test/webhook.test.ts

# 7. Commit
$ git commit -m "fix(gateway): default parse_mode to MarkdownV2

Fixes bug where MarkdownV2 conversion was skipped when
parse_mode was not explicitly set.

Closes TASK-001"

# 8. Push
$ git push

# 9. Update progress
$ Edit state/progress/TASK-001.md "## Git Operations\n**Committed:** Yes\n**Commit Hash:** abc123\n**Pushed:** Yes"

# 10. Notify success
# (Send via charmander bot to Telegram)
"✅ Committed and pushed: abc123"

# 11. Mark complete for orchestrator
$ npx tsx -e "import { updateProgressFile, STATUS_COMPLETE } from './lib/memory-manager.js';
updateProgressFile('review-git', 'TASK-001', { status: STATUS_COMPLETE });"

# 12. Mark git-decision progress file COMPLETE
$ Edit state/progress/TASK-001-git-decision.md
# Update Status to COMPLETE and add completion timestamp
# This is CRITICAL - the orchestrator monitors this file

# Orchestrator detects COMPLETE and advances pipeline
```

## Remember

- **Wait for user response** - Don't auto-commit
- **Confirm commit message** - User may want to edit
- **Check git status first** - Ensure correct files staged
- **Handle errors gracefully** - Notify user of failures
- **Update progress file** - Record commit hash and push status
- **Mark COMPLETE** - Triggers orchestrator to advance pipeline
- **Mark git-decision progress file COMPLETE** - Update `TASK-XXX-git-decision.md` status to COMPLETE after git operations. This is CRITICAL for orchestrator detection.
