# Dev-Workspace Session Issues

Created: 2026-02-23

## Issues Identified

### 1. Single Session Model
**Current State:** Only one session can be active at a time. No multi-session support.

**Problem:** When starting a new Claude Code instance, it assumes the existing session rather than creating a new one. Multiple Claude instances cannot work independently.

**Desired State:** Multiple Claude Code instances can run simultaneously, each with their own session, working on same project (different tasks) or different projects.

**Related Considerations:**
- Git worktrees for parallel work within same repo
- Session isolation and conflict prevention
- Lock ownership per session

---

### 2. Lock Ownership by Session
**Current State:** Locks are owned by `sessionId`, found by matching `ownerId === sessionId`.

**Problem:** Tied to issue #1. With multiple sessions, lock ownership becomes more complex.

**Desired State:** Clear session-to-lock ownership with proper multi-session support.

---

### 3. No Automatic Session Restoration
**Current State:** Session persists in `active.json` but there's no explicit "resume" concept.

**Problem:** When Claude Code restarts, it's unclear which session to resume or if a new one should be created.

**Desired State:** Clear session lifecycle with explicit resume/new behavior.

---

### 4. TTL-based Expiration Requires Manual Cleanup
**Current State:** Locks have a TTL but require `cleanup-locks` command to mark them as expired.

**Problem:** Stale locks can persist indefinitely without manual intervention.

**Desired State:** Automatic or more proactive lock cleanup.

---

### 5. Atomic Writes
**Current State:** Uses temp file + rename pattern.

**Status:** This is working correctly, no change needed.

---

## Priority Order

1. **Multi-session support** - Foundation for all other improvements
2. **Git worktree integration** - Enables parallel work on same repo
3. **Session restoration semantics** - Clear lifecycle
4. **Automatic lock cleanup** - Hygiene improvement
