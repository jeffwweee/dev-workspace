# Dev-Workspace v3 - Workspace Context

## Purpose

A plug-and-play Claude Code workspace supporting **multiple concurrent CC sessions** across **multiple projects**, with a shared control plane for state, locks, queues, and audit logs.

## Architecture

```
dev-workspace/
├── .claude/              # Claude Code configuration
│   ├── commands/         # Custom CLI commands (optional)
│   ├── policies/         # Orchestrator rules and safety gates
│   ├── references/       # Reusable reference docs
│   ├── skills/           # Delegatable skills for CC
│   └── WORKSPACE_CONTEXT.md  # This file
├── bin/                  # CLI implementation
│   └── dw.js             # Main CLI command (run with node)
├── registry/             # Project registry
├── state/                # Runtime state (locks, queue, sessions)
├── refs/                 # Reference docs and templates
└── projects/             # Individual projects
```

## Key Concepts

### 1. Sessions
- Created with `node bin/dw.js init`
- Identified by unique session ID (SESS-XXX)
- Tracked in `state/active.json`

### 2. Locks
- Acquired with `node bin/dw.js claim --task <id>`
- Prevents concurrent work on same resources
- TTL: 2 hours (extendable with heartbeat)
- Tracked in `state/locks.json`

### 3. Projects
- Added with `node bin/dw.js add <name> --path <path>`
- Switched with `node bin/dw.js switch <project>`
- Registered in `registry/projects.json`

### 4. Queue
- Managed via `tasks.json` in each project
- Tracked in `state/queue.json`
- Pick next task with `node bin/dw.js pick-next`

### 5. Audit Log
- All actions logged to `state/audit.log`
- JSONL format for parsing
- Append-only for traceability

## Directory Structure

### State Management
- `state/active.json` - Current session and active project
- `state/locks.json` - Lock table with TTL
- `state/queue.json` - Task queue across projects
- `state/sessions/` - Per-session state (optional)
- `state/audit.log` - Append-only event log

### Registry
- `registry/projects.json` - Registered projects

### Reference
- `refs/templates/QUICKSTART.md` - User guide
- `refs/best-practices/` - Best practice docs

## CLI Commands

| Command | Description |
|---------|-------------|
| `node bin/dw.js init` | Create new session |
| `node bin/dw.js add <name> --path <path>` | Add project |
| `node bin/dw.js switch <project>` | Set active project |
| `node bin/dw.js status [--json]` | Show status |
| `node bin/dw.js claim [--task <id>]` | Acquire lock |
| `node bin/dw.js release [--all]` | Release locks |
| `node bin/dw.js heartbeat` | Extend lock TTL |
| `node bin/dw.js cleanup-locks` | Mark stale locks |
| `node bin/dw.js pick-next` | Get next task |
| `node bin/dw.js record-result` | Log completion |

## Skills

| Skill | Purpose |
|-------|---------|
| `project-session` | Main orchestrator |
| `project-planner` | Task management |
| `docs-creator` | Documentation |
| `git-agent` | Git operations |
| `code-reviewer` | Code review |
| `tester` | Testing and verification |

## Safety Gates

Three gates ensure safe operations:

1. **Start Gate** - Correct project, lock claimed, context loaded
2. **Completion Gate** - Verification run, progress updated, git checkpoint
3. **End Gate** - Progress logged, tasks updated, lock released, audit logged

See `.claude/policies/SAFETY_GATES.md` for details.

## Error Codes

| Code | Meaning |
|------|---------|
| `DW_LOCKED` | Resource already locked |
| `DW_NO_PROJECT` | Project not found |
| `DW_INVALID_TASK` | Task ID not found |
| `DW_NOT_OWNER` | Cannot release other's lock |
| `DW_NO_SESSION` | No active session |
| `DW_MISSING_PATH` | Project path required |
| `DW_CORRUPT_STATE` | JSON parse/write error |

## Usage Workflow

```bash
# In each tmux pane/terminal:
cd dev-workspace
node bin/dw.js init                              # Create session
node bin/dw.js add myproject --path ../myproject # Add project
node bin/dw.js switch myproject                  # Set active
node bin/dw.js claim --task TASK-001             # Claim lock
# ... work happens ...
node bin/dw.js record-result --task TASK-001 --status passed
node bin/dw.js release --all                     # Release lock
```

## Multi-Session Support

Each session (tmux pane, terminal, or CC instance) should:
1. Run `node bin/dw.js init` to get unique session ID
2. Claim locks before any work
3. Release locks when done
4. Use `node bin/dw.js status` to see locks held by other sessions

## Best Practices

1. **Always claim locks before work** - Prevents conflicts
2. **Use `node bin/dw.js heartbeat`** - Keep locks alive during long work
3. **Update progress.md** - Document what was done
4. **Run `node bin/dw.js status --json`** - Script-friendly output
5. **Check audit.log** - Full traceability
