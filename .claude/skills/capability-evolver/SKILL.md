---
name: capability-evolver
description: "Self-evolution engine for dev-workspace. Analyzes runtime history to identify improvements and applies protocol-constrained evolution. Use for showing evolution status, forcing solidification, exporting backups, and marking genes as publishable."
---

# Capability Evolver

## Overview

Self-evolution engine for dev-workspace based on GEP (Genome Evolution Protocol). Enables Claude Code sessions to learn and improve over time.

**Announce at start:** "I'm using the capability-evolver skill to manage workspace evolution."

## Commands

### Default: Show Status

```bash
/evolve
```

Shows current evolution status:
- Total genes in registry
- Active sessions with signals
- Recent events
- Top genes by GDI score

### `--solidify`: Force Solidification

```bash
/evolve --solidify
```

Forces solidification of current session's signals into gene candidates.

### `--export`: Export Backup

```bash
/evolve --export
```

Exports all Redis data to file system backup at `~/.claude/evolution/export/`.

### `--publish <gene-id>`: Mark Publishable

```bash
/evolve --publish gene-20260225-abc123
```

Marks a gene as publishable, copying it to `_publishable/` directory.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  CAPABILITY EVOLVER                      │
├─────────────────────────────────────────────────────────┤
│  signals.js    → Emit signals to Redis                  │
│  solidify.js   → Convert signals to gene candidates     │
│  validate.js   → Apply tiered validation gates          │
│  promote.js    → Add candidates to registry             │
│  export.js     → Backup to file system                  │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                     REDIS                                │
├─────────────────────────────────────────────────────────┤
│  evolution:genes:registry        (Sorted Set)           │
│  evolution:gene:{id}             (Hash)                 │
│  evolution:events                (List)                 │
│  evolution:session:{id}:signals  (List)                 │
└─────────────────────────────────────────────────────────┘
```

## Signal Types

| Type | When to Emit | Example Data |
|------|--------------|--------------|
| `pattern` | Repeated action | `{pattern: "error-retry", count: 3}` |
| `repair` | Error recovered | `{error: "ECONNREFUSED", fix: "timeout"}` |
| `innovation` | Novel solution | `{approach: "caching", outcome: "2x faster"}` |
| `completion` | Task done | `{taskId: "TASK-001", duration: 45}` |
| `interrupted` | User stopped | `{taskId: "TASK-002", progress: "40%"}` |
| `timeout` | Op timed out | `{operation: "npm-install", duration: 120}` |
| `stuck` | Review loop | `{stuckType: "review-loop", loopCount: 4}` |

## Integration Points

**Called by:**
- `project-session` - At session start (load genes)
- `finishing-a-development-branch` - At session end (solidify)

## Safety Rules

1. **NEVER auto-delete genes** - Only mark as deprecated
2. **ALWAYS validate before promote** - Never bypass gates
3. **NEVER modify genes directly** - Use mutation process
4. **ALWAYS export before major changes** - Backup first

## Error Handling

- **Redis connection failed**: Check if Redis is running (`redis-cli ping`)
- **Session not found**: Session may have expired (24h TTL)
- **Gene not found**: Check gene ID format (gene-YYYYMMDD-hash8)

## Example

```
User: /evolve

Evolution Status
================

Registry:
- Genes: 12
- Capsules: 3

Top Genes (by GDI):
1. gene-20260225-abc (0.92) - "Error retry pattern"

Status: SUCCESS
```
