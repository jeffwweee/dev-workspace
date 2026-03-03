# Dev-Workspace v3 - Quickstart Guide

## Setup

### 1. Clone and Install

```bash
cd dev-workspace
npm install
npm run build
```

### 2. Initialize Workspace

```bash
./bin/dw init
```

Output:
```json
{
  "success": true,
  "sessionId": "sess-abc123...",
  "startTime": "2024-01-15T10:30:00Z",
  "message": "Session initialized successfully"
}
```

### 3. Add a Project

```bash
./bin/dw add myproject --path ../myproject
```

Or add the sample project:
```bash
./bin/dw add sample-project --path ./projects/sample-project
```

### 4. Switch to Project

```bash
./bin/dw switch myproject
```

Output:
```json
{
  "success": true,
  "project": {
    "id": "PROJ-abc123...",
    "name": "myproject",
    "path": "../myproject",
    "remote": null
  },
  "message": "Switched to project 'myproject'"
}
```

## Daily Workflow

### Start Work Session

```bash
# 1. Initialize session
./bin/dw init

# 2. Switch to project
./bin/dw switch myproject

# 3. Check status
./bin/dw status
```

### Work on a Task

```bash
# 4. Claim lock on task
./bin/dw claim --task TASK-001

# 5. Do the work (use Claude Code skills)
/skill project-session --task TASK-001

# 6. Record result
./bin/dw record-result --task TASK-001 --status passed --files "src/main.ts" --summary "Implemented feature"

# 7. Release lock
./bin/dw release --all
```

### Get Next Task

```bash
./bin/dw pick-next
```

Output:
```json
{
  "success": true,
  "task": {
    "id": "TASK-002",
    "projectId": "PROJ-abc123...",
    "title": "Add user authentication",
    "priority": 1
  },
  "message": "Selected task: Add user authentication"
}
```

## Multi-Session Setup (tmux)

### Terminal 1 (Backend work)

```bash
cd dev-workspace
./bin/dw init
./bin/dw switch myproject
./bin/dw claim --task TASK-001
# Work on backend...
./bin/dw release --all
```

### Terminal 2 (Frontend work)

```bash
cd dev-workspace
./bin/dw init
./bin/dw switch myproject
./bin/dw claim --task TASK-002
# Work on frontend...
./bin/dw release --all
```

Each terminal gets its own session ID and can work independently.

## Command Reference

### Session Management

```bash
./bin/dw init              # Create new session
./bin/dw status            # Show status
./bin/dw status --json     # JSON output
```

### Project Management

```bash
./bin/dw add <name> --path <path> [--remote <url>]
./bin/dw switch <project>
./bin/dw list-projects
```

### Lock Management

```bash
./bin/dw claim [--project <id>] [--task <task_id>] [--ttl <minutes>]
./bin/dw release [--lock <id>] [--all]
./bin/dw heartbeat [--lock <id>]
./bin/dw cleanup-locks [--force]
```

### Task Management

```bash
./bin/dw pick-next [--project <id>]
./bin/dw record-result --task <id> --status <status> --files <files> --summary <text>
./bin/dw queue
```

## Status Values

For `record-result --status`:
- `passed` - Task completed successfully
- `failed` - Task failed
- `partial` - Task partially complete
- `blocked` - Task is blocked

## Troubleshooting

### "DW_LOCKED" Error

Another session holds the lock. Check:
```bash
./bin/dw status
```

Look at the "locks" section to see who owns it.

### Lock Expired

Locks expire after 2 hours. Extend during long work:
```bash
./bin/dw heartbeat
```

### Project Not Found

Add project first:
```bash
./bin/dw add myproject --path ../myproject
```

### "DW_NO_SESSION" Error

Initialize session first:
```bash
./bin/dw init
```

### Stale Locks

Clean up expired locks:
```bash
./bin/dw cleanup-locks
```

Or force cleanup (locks older than 24 hours):
```bash
./bin/dw cleanup-locks --force
```

## Checking Audit Log

View all events:
```bash
cat state/audit.log | jq
```

Filter by event type:
```bash
cat state/audit.log | jq 'select(.event == "lock_claimed")'
```

Filter by session:
```bash
cat state/audit.log | jq 'select(.sessionId == "sess-abc123...")'
```

## Claude Code Integration

### Using Skills

After claiming a lock, invoke skills:

```
/skill project-session --task TASK-001
/skill project-planner --update-task TASK-001 --status completed
/skill docs-creator --update-progress
/skill git-agent --commit --message "feat: Add feature"
/skill tester --run
/skill code-reviewer --review src/main.ts
```

### Safety Gates

Always follow the safety gates:

1. **Start Gate** - `dw init`, `dw switch`, `dw claim`
2. **Completion Gate** - Verify tests, update progress, git commit
3. **End Gate** - `dw record-result`, update tasks, `dw release`

See `.claude/policies/SAFETY_GATES.md` for details.

## Tips

1. **Use `--json` flag** for scripting: `dw status --json | jq .session`
2. **Run `dw heartbeat`** every hour during long work
3. **Check `dw queue`** to see pending tasks
4. **Always release locks** when done work
5. **Review audit.log** to see what happened
