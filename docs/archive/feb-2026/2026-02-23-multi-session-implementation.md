# Multi-Session Support - Implementation Plan

**Design:** [2026-02-23-multi-session-design.md](./2026-02-23-multi-session-design.md)

## Phase 1: Core Session Infrastructure

### 1.1 Update State Manager
- [ ] Add `SessionData` interface for per-session state
- [ ] Add `SessionsRegistry` interface for sessions.json
- [ ] Add `getSessionPath(sessionId)` function
- [ ] Add `listSessions()`, `getSession()`, `createSession()`, `updateSession()`, `deleteSession()` functions
- [ ] Add `updateLastActivity()` helper

### 1.2 Migrate Existing Session Data
- [ ] Create migration script to convert `active.json` to `sessions.json` + `sessions/SESS-XXX.json`
- [ ] Run migration on first `dw init` with new code
- [ ] Keep `active.json` as backup

### 1.3 Update Lock Manager
- [ ] Update `claim()` to use session ID from registry
- [ ] Update `release()` to work with session-based ownership
- [ ] No structural changes to locks.json needed

## Phase 2: Session Commands

### 2.1 Update `dw init`
- [ ] Show session picker when sessions exist
- [ ] Create new session option
- [ ] Resume existing session option
- [ ] Mark old sessions (>24h) with warning
- [ ] Create per-session state file on new session

### 2.2 Add `dw new`
- [ ] Create new session without picker
- [ ] Prompt for project selection

### 2.3 Add `dw resume`
- [ ] Resume session by ID
- [ ] Update lastActivity

### 2.4 Add `dw sessions`
- [ ] List all sessions with status
- [ ] Show project, task, last activity

### 2.5 Add `dw end`
- [ ] Check for uncommitted changes
- [ ] Check for open locks
- [ ] Update session status to "ended"
- [ ] Remove from registry

### 2.6 Update `dw status`
- [ ] Show current session details
- [ ] Show summary of all other sessions

## Phase 3: Worktree Integration

### 3.1 Add Worktree Utilities
- [ ] Add `createWorktree(projectPath, taskId, branchName)` function
- [ ] Add `removeWorktree(worktreePath)` function
- [ ] Add `listWorktrees(projectPath)` function
- [ ] Add `getWorktreePath(projectName, taskId)` helper

### 3.2 Update `dw claim --task`
- [ ] Check for conflicting locks
- [ ] Create worktree if not exists
- [ ] Create lock with session ownership
- [ ] Update session with taskId and worktreePath
- [ ] Output worktree path for user

### 3.3 Add `dw worktree` Commands
- [ ] `dw worktree list` - List all worktrees
- [ ] `dw worktree create <task-id>` - Manual worktree creation
- [ ] `dw worktree remove <task-id>` - Manual worktree removal

### 3.4 Update `dw record-result`
- [ ] Add `--pr <url>` option
- [ ] Store PR URL in session
- [ ] Prompt for worktree removal on passed status
- [ ] Release locks on completion

## Phase 4: Cleanup & Maintenance

### 4.1 Add `dw cleanup`
- [ ] Mark expired sessions (>24h inactive)
- [ ] Release locks for expired sessions
- [ ] Mark expired locks
- [ ] List orphaned worktrees

### 4.2 Session Heartbeat
- [ ] Auto-update lastActivity on each command
- [ ] Consider adding explicit `dw heartbeat` if needed

## Phase 5: Testing & Migration

### 5.1 Testing
- [ ] Unit tests for session manager
- [ ] Unit tests for worktree utilities
- [ ] Integration tests for multi-session flows
- [ ] Manual testing with multiple Claude instances

### 5.2 Migration Guide
- [ ] Document migration from v1 to v2
- [ ] Update CLAUDE.md with new commands
- [ ] Update skill docs (project-session, etc.)

## Implementation Order

```
Phase 1.1 → 1.2 → 1.3 → Phase 2.1 → 2.4 → 2.6 → Phase 3.1 → 3.2 → 3.4 → Phase 4.1 → 5.1 → 5.2
                  ↓
            Phase 2.2 → 2.3 → 2.5 → Phase 3.3 (parallel)
```

**Critical path:** 1.1 → 1.2 → 2.1 → 2.4 → 3.1 → 3.2 → 3.4

## Estimated Tasks

| Phase | Tasks | Priority |
|-------|-------|----------|
| Phase 1 | 11 | P0 - Blocking |
| Phase 2 | 14 | P0 - Core UX |
| Phase 3 | 11 | P1 - Worktree |
| Phase 4 | 5 | P2 - Maintenance |
| Phase 5 | 7 | P2 - Polish |

**Total:** 48 tasks
