---
name: finishing-a-development-branch
description: Use when implementation is complete, all tests pass, and you need to decide how to integrate the work - guides completion of development work by presenting structured options for merge, PR, or cleanup
---

# Finishing a Development Branch

## Overview

Guide completion of development work by presenting clear options and handling chosen workflow.

**Core principle:** Verify tests → Present options → Execute choice → Clean up.

**Announce at start:** "I'm using the finishing-a-development-branch skill to complete this work."

## Context: Dev-Workspace Integration

This skill integrates with dev-workspace session and lock management:

**Prerequisites:**
- Active session exists
- Task has been claimed (lock held)
- Work completed in worktree at `~/worktrees/<project>/<task>/`

## Evolution Integration

At session end, solidify signals into genes:

### Pre-Completion: Solidify Session

Before verifying tests (Step 1), run solidification:

```bash
# Evolution: Solidify session signals into gene candidates
node -e "
const solidify = require('./.claude/skills/capability-evolver/scripts/solidify.cjs');
const promote = require('./.claude/skills/capability-evolver/scripts/promote.cjs');
const exportModule = require('./.claude/skills/capability-evolver/scripts/export.cjs');

async function evolve() {
  const sessionId = process.env.CLAUDE_SESSION_ID || 'local';

  try {
    // Solidify signals
    const solidified = await solidify.solidify(sessionId);
    console.log('Evolution: ' + solidified.message);

    // Promote candidates
    const promoted = await promote.promoteSessionCandidates(sessionId);
    console.log('Evolution: ' + promoted.message);

    // Export backup
    const exported = await exportModule.exportAll();
    console.log('Evolution: Exported ' + exported.genes.exported + ' genes');
  } catch (err) {
    console.log('Evolution: ' + err.message + ' (non-critical)');
  }
}

evolve();
" 2>/dev/null || true
```

This reports: "Session contributed X new genes"

## The Process

### Step 1: Verify Tests

**Before presenting options, verify tests pass:**

```bash
# Run project's test suite
npm test / cargo test / pytest / go test ./...
```

**If tests fail:**
```
Tests failing (<N> failures). Must fix before completing:

[Show failures]

Cannot proceed with merge/PR until tests pass.
```

Stop. Don't proceed to Step 2.

**If tests pass:** Continue to Step 2.

### Step 2: Determine Base Branch

```bash
# Try common base branches
git merge-base HEAD main 2>/dev/null || git merge-base HEAD master 2>/dev/null
```

Or ask: "This branch split from main - is that correct?"

### Step 3: Present Options

Present exactly these 4 options:

```
Implementation complete. What would you like to do?

1. Merge back to <base-branch> locally
2. Push and create a Pull Request
3. Keep the branch as-is (I'll handle it later)
4. Discard this work

Which option?
```

**Don't add explanation** - keep options concise.

### Step 4: Execute Choice

#### Option 1: Merge Locally

```bash
# Switch to base branch
git checkout <base-branch>

# Pull latest
git pull

# Merge feature branch
git merge <feature-branch>

# Verify tests on merged result
<test command>

# If tests pass
git branch -d <feature-branch>
```

Then: Cleanup worktree and release lock (Step 5)

#### Option 2: Push and Create PR

```bash
# Push branch
git push -u origin <feature-branch>

# Create PR
gh pr create --title "<title>" --body "$(cat <<'EOF'
## Summary
<2-3 bullets of what changed>

## Test Plan
- [ ] <verification steps>
EOF
)"
```

Then: Update session and release lock (Step 5)

#### Option 3: Keep As-Is

Report: "Keeping branch <name>. Worktree preserved at <path>."

**Don't cleanup worktree or release lock.**

#### Option 4: Discard

**Confirm first:**
```
This will permanently delete:
- Branch <name>
- All commits: <commit-list>
- Worktree at <path>

Type 'discard' to confirm.
```

Wait for exact confirmation.

If confirmed:
```bash
git checkout <base-branch>
git branch -D <feature-branch>
```

Then: Cleanup worktree and release lock (Step 5)

### Step 5: Cleanup and Release

**For Options 1, 2, 4:**

```bash
# Check if in worktree
git worktree list | grep $(git branch --show-current)

# Remove worktree if exists
git worktree remove <worktree-path>
```

**Release the lock:**
```bash
node bin/dw.js release --all
```

**Record result (if PR created):**
```bash
node bin/dw.js record-result --task TASK-XXX --status passed --pr https://github.com/.../pull/42
```

**For Option 3:** Keep worktree and lock.

## Quick Reference

| Option | Merge | Push | Keep Worktree | Keep Lock | Cleanup Branch |
|--------|-------|------|---------------|-----------|----------------|
| 1. Merge locally | Yes | - | No | No | Yes |
| 2. Create PR | - | Yes | No | No | No |
| 3. Keep as-is | - | - | Yes | Yes | No |
| 4. Discard | - | - | No | No | Yes (force) |

## Dev-Workspace Session Flow

```
[Implementation complete, tests pass]
    ↓
finishing-a-development-branch
    ↓
Option 1: Merge → git merge → cleanup → release
Option 2: PR → gh pr create → cleanup → release + record-result
Option 3: Keep → done (lock still held)
Option 4: Discard → confirm → cleanup → release
    ↓
node bin/dw.js release --all
```

## Common Mistakes

**Skipping test verification**
- **Problem:** Merge broken code, create failing PR
- **Fix:** Always verify tests before offering options

**Open-ended questions**
- **Problem:** "What should I do next?" → ambiguous
- **Fix:** Present exactly 4 structured options

**Releasing lock prematurely**
- **Problem:** Release lock before PR is created
- **Fix:** Release only after chosen workflow is complete

**No confirmation for discard**
- **Problem:** Accidentally delete work
- **Fix:** Require typed "discard" confirmation

## Red Flags

**Never:**
- Proceed with failing tests
- Merge without verifying tests on result
- Delete work without confirmation
- Force-push without explicit request
- Release lock before work is safely stored

**Always:**
- Verify tests before offering options
- Present exactly 4 options
- Get typed confirmation for Option 4
- Release lock after work is complete (except Option 3)

## Integration

**Called by:**
- **subagent-driven-development** - After all tasks complete
- **executing-plans** - After all batches complete
- **project-session** - At completion gate

**Pairs with:**
- **verification-before-completion** - Run before this skill
- **docs-creator** - Update progress.md before finishing

**Dev-Workspace Commands:**
- `node bin/dw.js release --all` - Release locks
- `node bin/dw.js record-result` - Record PR/merge status
- `node bin/dw.js worktree remove` - Manual worktree cleanup
