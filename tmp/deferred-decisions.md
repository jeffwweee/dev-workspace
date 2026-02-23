# Deferred Decisions

Created: 2026-02-23

## 1. PR Management Workflow

**Status:** Deferred

**Context:**
- Work session creates PR, separate PR management session handles merging
- `dw record-result --pr <url>` stores PR URL with session/task
- Need cleanup mechanism for worktrees after PR merged

**Options to explore:**
1. `dw pr list` - Shows open PRs with worktrees, `dw pr cleanup --merged`
2. Auto-detect from git - `dw cleanup` checks worktrees against remote
3. Manual tracking - Store PR URL, `dw pr status` checks merge state

**Related idea:** Consider building a separate tg-agent-like service using Redis for:
- PR state tracking
- Cross-session coordination
- Real-time notifications

---

## 2. Redis-based Coordination Service

**Status:** Idea phase

**Potential use cases:**
- PR management and state tracking
- Cross-session lock coordination (more robust than file-based)
- Real-time session status updates
- Task queue management

**Consider building:** A tg-agent-style service that uses Redis as backend

---

## Notes

Revisit these after core multi-session support is implemented.
