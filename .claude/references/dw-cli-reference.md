# DW CLI Reference

Complete reference for the `dw` (dev-workspace) CLI commands.

## Usage

```bash
node bin/dw.js <command> [options]
```

## Session Commands

### `init`
Create a new session with unique session ID.

```bash
node bin/dw.js init
# Output: Session created: sess-abc123
```

### `status`
Show current session, active project, and locks.

```bash
node bin/dw.js status [--json]
```

| Flag | Description |
|------|-------------|
| `--json` | Output in JSON format for scripting |

## Project Commands

### `add`
Register a new project.

```bash
node bin/dw.js add <name> --path <path>
```

| Argument | Description |
|----------|-------------|
| `<name>` | Project identifier |
| `--path` | Absolute or relative path to project |

### `switch`
Set the active project.

```bash
node bin/dw.js switch <project-name>
```

### `list-projects`
List all registered projects.

```bash
node bin/dw.js list-projects
```

## Lock Commands

### `claim`
Acquire a lock on a task or resource.

```bash
node bin/dw.js claim --task <task-id>
node bin/dw.js claim --project <project-id>
```

| Flag | Description |
|------|-------------|
| `--task` | Lock specific task |
| `--project` | Lock entire project |

### `release`
Release held locks.

```bash
node bin/dw.js release --all
node bin/dw.js release --task <task-id>
```

| Flag | Description |
|------|-------------|
| `--all` | Release all locks held by session |
| `--task` | Release specific task lock |

### `heartbeat`
Extend lock TTL (default +2 hours).

```bash
node bin/dw.js heartbeat
```

### `cleanup-locks`
Mark expired locks as stale.

```bash
node bin/dw.js cleanup-locks
```

## Task Commands

### `pick-next`
Get the next available task from queue.

```bash
node bin/dw.js pick-next
```

### `queue`
Show task queue across all projects.

```bash
node bin/dw.js queue
```

### `record-result`
Log task completion with status and summary.

```bash
node bin/dw.js record-result --task <task-id> --status <status> --files "<files>" --summary "<text>"
```

| Flag | Description |
|------|-------------|
| `--task` | Task ID |
| `--status` | `passed`, `failed`, `partial`, `blocked` |
| `--files` | Comma-separated list of changed files |
| `--summary` | Brief description of work done |

## Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| `DW_LOCKED` | Resource already locked | Wait or contact lock owner |
| `DW_NO_SESSION` | No active session | Run `node bin/dw.js init` |
| `DW_NO_PROJECT` | Project not found | Run `node bin/dw.js add` first |
| `DW_INVALID_TASK` | Task ID not found | Check tasks.json |
| `DW_NOT_OWNER` | Cannot release other's lock | Use correct session |
| `DW_MISSING_PATH` | Project path required | Add `--path` flag |
| `DW_CORRUPT_STATE` | JSON parse/write error | Check state files |

## Typical Workflow

```bash
# 1. Initialize session
node bin/dw.js init

# 2. Add and switch to project (first time only)
node bin/dw.js add myproject --path ../myproject
node bin/dw.js switch myproject

# 3. Claim task
node bin/dw.js claim --task TASK-001

# 4. ... do work ...

# 5. Record result
node bin/dw.js record-result --task TASK-001 --status passed --files "src/main.ts" --summary "Implemented feature"

# 6. Release lock
node bin/dw.js release --all
```

## State Files

| File | Purpose |
|------|---------|
| `state/active.json` | Current session and active project |
| `state/locks.json` | Lock table with TTL |
| `state/queue.json` | Task queue across projects |
| `state/audit.log` | Append-only event log |
| `registry/projects.json` | Registered projects |
