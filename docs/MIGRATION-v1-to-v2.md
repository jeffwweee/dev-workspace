# Migration Guide: v1 to v2

This guide covers migrating from the single-session (v1) to multi-session (v2) architecture.

## What Changed

### State Structure

**Before (v1):**
```
state/
├── active.json          # Single session
├── locks.json
└── audit.log
```

**After (v2):**
```
state/
├── sessions.json        # Registry of all sessions
├── sessions/
│   ├── SESS-XXX.json    # Per-session state
│   └── SESS-YYY.json
├── locks.json           # Unchanged structure
├── .migrated-v2         # Migration flag
└── audit.log
```

### Session Interface

**Before (v1):**
```json
{
  "sessionId": "SESS-XXX",
  "activeProject": "PROJ-XXX",
  "startTime": "...",
  "status": "active"
}
```

**After (v2):**
```json
{
  "id": "SESS-XXX",
  "project": { "id": "PROJ-XXX", "name": "tg-agent", "path": "..." },
  "currentTask": "V2-016",
  "worktree": { "path": "~/worktrees/tg-agent/V2-016", "branch": "feature/V2-016" },
  "locks": ["LOCK-XXX"],
  "prUrl": null,
  "status": "active",
  "createdAt": "...",
  "lastActivity": "..."
}
```

## Automatic Migration

Migration happens automatically on first run of `dw init`:

```bash
node bin/dw.js init
# [dw] Migration: Migrated 1 session(s) to v2 format
```

The migration:
1. Creates `state/sessions.json` registry
2. Creates `state/sessions/` directory with per-session files
3. Backs up `active.json` to `active.json.v1-backup`
4. Creates `state/.migrated-v2` flag file

## New Commands

| Command | Description |
|---------|-------------|
| `dw init --new` | Create new session (skip picker) |
| `dw init --resume <id>` | Resume specific session |
| `dw new` | Alias for `dw init --new` |
| `dw resume <id>` | Alias for `dw init --resume <id>` |
| `dw sessions [--all]` | List all sessions |
| `dw end <id>` | End a session |
| `dw activity [id]` | Update session activity |
| `dw worktree list` | List worktrees |
| `dw cleanup [--prune]` | Clean expired sessions/locks |
| `dw prune-worktrees` | Remove orphaned worktrees |

## Changed Commands

| Command | Change |
|---------|--------|
| `dw init` | Now shows session picker instead of error if session exists |
| `dw status` | Shows all sessions, not just current |
| `dw claim --task <id>` | Now auto-creates worktree in `~/worktrees/<project>/<task>/` |
| `dw heartbeat` | Now also updates session activity |

## Deprecated Commands

| Command | Replacement |
|---------|-------------|
| `dw switch <project>` | Use `dw claim --project <project>` or set project during claim |

## Workflow Changes

### Starting a Session

**Before:**
```bash
node bin/dw.js init                    # Error if session exists
node bin/dw.js switch tg-agent
node bin/dw.js claim --task V2-016
```

**After:**
```bash
node bin/dw.js init                    # Picker: resume or create new
node bin/dw.js claim --task V2-016     # Auto-creates worktree
# Working in ~/worktrees/tg-agent/V2-016
```

### Multiple Sessions

You can now have multiple Claude Code instances running:

```bash
# Terminal 1
node bin/dw.js init --new
node bin/dw.js claim --project tg-agent --task V2-016

# Terminal 2
node bin/dw.js init --new
node bin/dw.js claim --project tg-agent --task V2-014

# Each works in its own worktree
```

### Ending a Session

```bash
node bin/dw.js sessions                # List sessions
node bin/dw.js end SESS-XXX            # End specific session
```

## Rollback

To rollback to v1:

```bash
# Remove v2 state
rm -rf state/sessions state/sessions.json state/.migrated-v2

# Restore v1 backup
mv state/active.json.v1-backup state/active.json

# Checkout v1 code
git checkout main -- bin/
npm run build
```

## Troubleshooting

### Migration didn't run

Check for the migration flag:
```bash
ls state/.migrated-v2
```

If missing, migration will run on next `dw init`.

### Session not found

Sessions are stored in `state/sessions/`. Check:
```bash
ls state/sessions/
cat state/sessions/SESS-XXX.json
```

### Worktree issues

List worktrees:
```bash
node bin/dw.js worktree list
cd ~/worktrees/<project>/<task>
git status
```

Clean orphaned worktrees:
```bash
node bin/dw.js prune-worktrees --dry-run
node bin/dw.js prune-worktrees
```
