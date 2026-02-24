---
name: project-planner
description: "Task planning and management for dev-workspace projects. Manages tasks.json with task creation, status updates, dependency tracking, and priority management. Use for creating new tasks, updating task status, managing task dependencies, re-prioritizing work, and any changes to tasks.json."
---

# Project Planner

## Overview

Manages task planning, tracking, and updates to tasks.json. Handles task dependencies, priorities, and status updates.

## Commands

### Create Task Plan

Create a new task with appropriate priority and dependencies:

```bash
/project-planner --plan "Task description"
```

Output: Creates task in tasks.json with auto-generated ID.

### Update Task Status

Update task status in tasks.json:

```bash
/project-planner --update-task TASK-001 --status completed --passes true
```

See [conventions.md](../references/conventions.md#task-status-values) for status values.

### List Tasks

Show all tasks with status and dependencies:

```bash
/project-planner --list-tasks
```

### Add Dependency

Create dependency relationship between tasks:

```bash
/project-planner --add-dependency TASK-002 --depends-on TASK-001
```

## Task Schema

See [conventions.md](../references/conventions.md#task-schema) for complete schema.

## Priority Levels

See [conventions.md](../references/conventions.md#task-priority-levels) for priority definitions.

## Dependency Rules

1. **NEVER create circular dependencies** - Task A depends on B, B depends on A
2. **ALWAYS validate dependencies exist** - Check referenced task IDs exist
3. **DEPENDENT tasks auto-block** - Task B blocked until Task A completes
4. **UPDATES unlock dependents** - Marking Task A complete unblocks Task B

## Return Contract

See [return-contract.md](../references/return-contract.md).

## Safety Rules

1. **NEVER delete tasks** - Mark as `cancelled` instead
2. **ALWAYS update updatedAt** - Set timestamp on every modification
3. **ALWAYS set passes=true** - Only when task is truly complete
4. **NEVER skip validation** - Check dependencies exist before adding
5. **ALWAYS preserve structure** - Maintain JSON schema integrity

See [safety-rules.md](../references/safety-rules.md#write-operations) for patterns.

## Error Handling

- **If tasks.json doesn't exist**: Create with empty tasks array, set version: "1.0.0", notify user
- **If dependency doesn't exist**: Report error with missing task ID, do not add, suggest valid task IDs
- **If circular dependency detected**: Report the cycle (A -> B -> C -> A), do not apply changes

See [error-handling.md](../references/error-handling.md) for patterns.

## Example

```
User: /project-planner --update-task TASK-001 --status completed --passes true

Status: SUCCESS

Summary:
- Updated TASK-001 status to completed
- Set passes=true for TASK-001
- Unblocked dependent tasks: TASK-002, TASK-003

Files changed:
- tasks.json

Commands run:
- None (direct file edit)

Evidence:
- TASK-001: completed (passes=true)
- TASK-002: pending (previously blocked)
- TASK-003: pending (previously blocked)

Next recommended:
- node bin/dw.js pick-next
```

## Integration with writing-plans

### Creating Tasks for Implementation

```
# Step 1: Register the task
/project-planner --plan "Add retry mechanism to API client"
# Output: Created TASK-015

# Step 2: Create implementation plan (recommended next step)
/writing-plans --task TASK-015
```

### After Task Creation

When a new task is created, recommend:

```
Next recommended:
- /writing-plans --task TASK-XXX  (create implementation plan)
- node bin/dw.js claim --task TASK-XXX  (claim and start work)
```

### Workflow Chain

```
project-planner (register task)
    ↓
writing-plans --task TASK-XXX (create plan)
    ↓
executing-plans --task TASK-XXX (execute plan)
    ↓
project-planner --update-task TASK-XXX --status completed (mark done)
```
