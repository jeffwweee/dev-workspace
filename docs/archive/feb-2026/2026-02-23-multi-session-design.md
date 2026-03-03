# Multi-Session Support Design

**Date:** 2026-02-23
**Status:** Approved

## Overview

Enable multiple Claude Code instances to run simultaneously, each with their own session, working on the same project (different tasks) or different projects.

## Key Decisions

| Aspect | Decision |
|--------|----------|
| Architecture | Session-centric with registry + per-session files |
| Coordination | Worktrees for same repo, shared workspace for different projects |
| Session creation | Always prompt to pick (resume existing or create new) |
| Worktrees | Auto-create on `claim --task` in `~/worktrees/project/TASK/` |
| Worktree cleanup | Prompt on `record-result --status passed` |
| PR workflow | Store PR URL in session, cleanup deferred |
| Session TTL | 24h inactivity, manual cleanup |
| Lock coordination | Global locks.json with ownerId = sessionId |

## Architecture

```
state/
├── sessions.json              # Registry of all sessions
├── sessions/
│   ├── SESS-XXX.json          # Per-session state
│   └── SESS-YYY.json
├── locks.json                 # Global locks (ownerId = sessionId)
├── queue.json                 # Task queue (unchanged)
└── audit.log                  # Audit trail (unchanged)

registry/
└── projects.json              # Project registry (unchanged)

~/worktrees/
├── tg-agent/
│   ├── V2-016/               # Task-based worktrees
│   └── V2-014/
├── project-wingman/
│   └── TASK-001/
└── .archive/                  # Optional archive (future)
```

## Data Structures

### sessions.json (registry)

```json
{
  "sessions": [
    {
      "id": "SESS-XXX",
      "projectId": "PROJ-XXX",
      "projectName": "tg-agent",
      "taskId": "V2-016",
      "worktreePath": "/home/jeffrey/worktrees/tg-agent/V2-016",
      "status": "active",
      "createdAt": "2026-02-23T10:00:00Z",
      "lastActivity": "2026-02-23T11:30:00Z"
    }
  ],
  "version": "2.0"
}
```

### sessions/SESS-XXX.json (per-session)

```json
{
  "id": "SESS-XXX",
  "project": {
    "id": "PROJ-XXX",
    "name": "tg-agent",
    "path": "/home/jeffrey/jef-workspace/dev-workspace/tg-agent"
  },
  "currentTask": "V2-016",
  "worktree": {
    "path": "/home/jeffrey/worktrees/tg-agent/V2-016",
    "branch": "feature/V2-016-oauth",
    "createdAt": "2026-02-23T10:05:00Z"
  },
  "locks": ["LOCK-XXX"],
  "prUrl": "https://github.com/xxx/tg-agent/pull/42",
  "status": "active",
  "createdAt": "2026-02-23T10:00:00Z",
  "lastActivity": "2026-02-23T11:30:00Z"
}
```

### locks.json (unchanged structure, multi-session aware)

```json
{
  "locks": [
    {
      "lockId": "LOCK-XXX",
      "taskId": "V2-016",
      "ownerId": "SESS-XXX",
      "status": "active",
      "acquiredAt": "...",
      "expiresAt": "..."
    }
  ]
}
```

## CLI Commands

### New/Changed Commands

| Command | Description |
|---------|-------------|
| `dw init` | **Changed** - Shows session picker: list existing + "create new" option |
| `dw new` | **New** - Create new session explicitly (skip picker) |
| `dw resume <session-id>` | **New** - Resume specific session by ID |
| `dw status` | **Changed** - Shows current session + summary of all sessions |
| `dw sessions` | **New** - List all sessions with status |
| `dw end` | **New** - End current session (release locks, optional cleanup) |
| `dw claim --task <id>` | **Changed** - Auto-creates worktree if needed |
| `dw worktree` | **New** - Subcommands: `list`, `create`, `remove` |
| `dw record-result` | **Changed** - Accepts `--pr <url>`, prompts worktree removal on passed |

### Removed/Deprecated

- `dw switch` → absorbed into session creation/claim flow

## Session Lifecycle

### Starting a Session

```
dw init
├─ No sessions exist → create new session, pick project
└─ Sessions exist → show picker:
   ├─ [SESS-XXX] tg-agent / V2-016 (active, 2h ago)
   ├─ [SESS-YYY] tg-agent / V2-014 (active, 1d ago) ⚠️ old
   └─ [New] Create new session
   → User selects → resume or create
```

### Claiming a Task

```
dw claim --task V2-016
├─ Check for conflicting locks → fail if locked by another session
├─ Create worktree if not exists:
│  └─ git worktree add ~/worktrees/tg-agent/V2-016 -b feature/V2-016
├─ Create lock (ownerId = sessionId)
├─ Update session: taskId, worktreePath
└─ Output: "Working in ~/worktrees/tg-agent/V2-016"
```

### Completing a Task

```
dw record-result --status passed --pr https://github.com/.../pull/42
├─ Verify tests passed (or --skip-tests flag)
├─ Store prUrl in session
├─ Prompt: "Remove worktree? [y/N]"
│  ├─ y → git worktree remove, clear session.worktree
│  └─ N → keep worktree for PR session to manage
├─ Release locks
└─ Update session status
```

### Ending a Session

```
dw end
├─ Check for uncommitted changes in worktree → warn
├─ Check for open locks → prompt to release
├─ Update session status to "ended"
└─ Remove from sessions.json (or mark inactive)
```

## Session Expiration & Cleanup

### TTL Rules

- Session TTL: 24 hours of inactivity (configurable)
- Lock TTL: 2 hours (existing, unchanged)
- Worktree TTL: No auto-expiry (manual cleanup only)

### Cleanup Flow

```
dw cleanup
├─ Sessions:
│  ├─ Mark sessions inactive if lastActivity > 24h
│  └─ Release their locks
├─ Locks:
│  └─ Mark expired if expiresAt < now
└─ Worktrees:
   └─ List orphaned worktrees (no active session) --manual cleanup
```

### Startup Prompt for Old Sessions

```
dw init
→ Session SESS-YYY last active 26 hours ago. Resume anyway?
  [Resume] [Create New] [End Old Session]
```

## Files Changed

| File | Change |
|------|--------|
| `state/sessions.json` | New registry file |
| `state/sessions/SESS-XXX.json` | New per-session files |
| `state/locks.json` | Multi-session aware (unchanged structure) |
| `bin/lib/commands/init.ts` | Update to show session picker |
| `bin/lib/commands/status.ts` | Show all sessions |
| `bin/lib/commands/lock.ts` | Update claim for worktree creation |
| `bin/lib/commands/task.ts` | Update record-result for PR and worktree cleanup |
| `bin/lib/commands/session.ts` | New: session management commands |
| `bin/lib/commands/worktree.ts` | New: worktree management commands |
| `bin/lib/state/manager.ts` | Add session registry functions |
| `bin/dw.ts` | Register new commands |

## Deferred Items

See `tmp/deferred-decisions.md` for:
- PR management workflow
- Redis-based coordination service
