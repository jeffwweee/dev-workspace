# Dev-Workspace Evolution System Design

**Date**: 2026-02-25
**Status**: Approved
**Author**: Claude + User collaboration

## Overview

This document describes the design for integrating GEP (Genome Evolution Protocol) concepts into dev-workspace, enabling AI self-evolution capabilities where the workspace learns and improves from session to session.

## Goals (Priority Order)

1. **Quality** - Reinforce good patterns, prune bad ones
2. **Efficiency** - Reduce repetition across sessions
3. **Self-Improvement** - Workspace evolves autonomously
4. **Knowledge Sharing** - Cross-instance benefits (lower priority)

## Key Decisions

| Aspect | Decision |
|--------|----------|
| **Units of Evolution** | All (patterns, prompts, configs, workflows) |
| **Aggressiveness** | Balanced (70/30) - 70% stability, 30% experimentation |
| **Architecture** | Federated - project-level with promotion to workspace |
| **Activation** | Hybrid - session start + task completion + session end |
| **Validation** | Tiered - simple/multi-factor/behavioral based on risk |
| **Pruning** | Hybrid decay - time-based + performance-based |
| **Storage** | Redis (runtime) + File system (backup, Git-trackable) |
| **Sharing** | Private by default, opt-in publishable |

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DEV-WORKSPACE EVOLUTION SYSTEM                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    EXISTING SKILLS (Modified)                   │ │
│  │  project-session     → +LOAD genes, +INIT session              │ │
│  │  writing-plans       → +EMIT pattern signals                   │ │
│  │  executing-plans     → +EMIT signals per task                  │ │
│  │  finishing-branch    → +SOLIDIFY, +VALIDATE, +PROMOTE          │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                  │                                   │
│                                  ▼                                   │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    EVOLUTION ENGINE (New Skill)                │ │
│  │  /capability-evolver                                           │ │
│  │  - signals.js, solidify.js, validate.js                        │ │
│  │  - promote.js, prune.js, export.js                             │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                  │                                   │
│                                  ▼                                   │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    STORAGE LAYER                               │ │
│  │  Redis (Runtime)     → Fast access, session signals            │ │
│  │  File System (Local) → ~/.claude/evolution/ (backup, private)  │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Structures

### Gene Structure

```yaml
id: gene-20260225-a1b2c3d4        # gene-YYYYMMDD-hash8
type: pattern | prompt | config | workflow
name: "Consistent error handling pattern"
description: "When encountering API errors, log context, retry with backoff, then fallback"
version: 1

content: |
  When encountering API errors:
  1. Log full context (request, response, timestamp)
  2. Retry with exponential backoff (max 3 attempts)
  3. If still failing, use fallback strategy
  4. Emit signal for pattern tracking

metadata:
  createdAt: "2026-02-25T10:00:00Z"
  updatedAt: "2026-02-26T15:30:00Z"
  successRate: 0.85
  usageCount: 12
  lastUsed: "2026-02-26T15:30:00Z"
  consecutiveSuccesses: 4
  consecutiveFailures: 0

context:
  envFingerprint:
    node: "20.x"
    platform: "linux"
  applicableScenarios:
    - "api-integration"
    - "external-service-calls"
  tags: ["error-handling", "resilience", "api"]

mutations:
  - id: mut-001
    from: "v0 - basic retry"
    to: "v1 - added backoff and fallback"
    reason: "Improved success rate from 0.6 to 0.85"
    timestamp: "2026-02-26T10:00:00Z"

publishable: false
source: "session"
```

### Capsule Structure

```yaml
id: cap-20260225-e5f6a7b8
name: "Implement JWT authentication"
description: "Full workflow for adding JWT auth to an Express API"

genes:
  - gene-20260225-a1b2c3d4

executionPath:
  - step: 1
    action: "Install dependencies"
    command: "npm install jsonwebtoken bcryptjs"
    outcome: "success"
    duration: 12

validation:
  confidence: 0.92
  impactScope: 3
  consecutiveSuccesses: 2
  testPassRate: 1.0

auditLog:
  - timestamp: "2026-02-25T10:00:00Z"
    event: "created"
    session: "SESS-001"

scope: project
projectId: "my-api-project"
publishable: false
```

### Signal Types

| Signal | When Emitted | Data |
|--------|--------------|------|
| `pattern` | Repeated action detected | pattern name, trigger, context |
| `repair` | Error successfully recovered | error type, fix applied, success |
| `innovation` | Novel solution that worked | approach, outcome, context |
| `completion` | Task completed successfully | task id, approach used, metrics |
| `use` | Gene was applied | gene id, success, context |
| `interrupted` | User manually interrupted | task id, progress state, reason |
| `timeout` | Operation exceeded time limit | operation type, duration, threshold |
| `stuck` | Review loop or internal error | stuckType, indicator, loopCount |

### Event Structure (JSONL)

```jsonl
{"ts":"2026-02-25T10:00:00Z","type":"signal","category":"pattern","session":"SESS-001","data":{"pattern":"error-handling","trigger":"api-failure"}}
{"ts":"2026-02-25T10:05:00Z","type":"signal","category":"repair","session":"SESS-001","data":{"error":"ECONNREFUSED","fix":"added-timeout","success":true}}
{"ts":"2026-02-25T14:00:00Z","type":"signal","category":"stuck","session":"SESS-001","data":{"taskId":"TASK-005","stuckType":"review-loop","loopCount":4}}
{"ts":"2026-02-25T11:00:00Z","type":"solidify","session":"SESS-001","data":{"geneId":"gene-20260225-abc"}}
{"ts":"2026-02-25T11:10:00Z","type":"promote","session":"SESS-001","data":{"geneId":"gene-20260225-abc"}}
```

## Redis Schema

```
# Gene Registry & Data
evolution:genes:registry              # Sorted Set: gene_id → GDI score
evolution:gene:{gene_id}              # Hash: full gene data
evolution:gene:{gene_id}:metadata     # Hash: metrics

# Capsule Registry & Data
evolution:capsules:registry           # Set: all capsule IDs
evolution:capsule:{capsule_id}        # Hash: full capsule data

# Event Streams
evolution:events                      # List: global event stream
evolution:session:{session_id}:signals # List: per-session signals

# Publishing
evolution:publishable                 # Set: publishable gene IDs
evolution:pending:promotion           # List: candidates pending promotion

# Project-Scoped
evolution:project:{project_id}:genes  # Set: project gene IDs
evolution:project:{project_id}:capsules # Set: project capsule IDs

# Session Tracking
evolution:sessions:active             # Set: active session IDs
evolution:session:{session_id}:state  # Hash: session state
```

### TTL Strategy

| Key | TTL | Reason |
|-----|-----|--------|
| `evolution:session:{id}:signals` | 24h | Temporary, solidified at session end |
| `evolution:session:{id}:state` | 48h | Session state cleanup |
| Gene/Capsule data | No TTL | Persistent until pruned |

## Skill Integration

### /project-session (Modified)

```
EXISTING:
  1. Parse args, validate project
  2. Claim lock
  3. Load project context
  4. Delegate to appropriate skill

NEW (Phase 1):
  + After step 3: Load relevant genes from Redis
  + Include genes in session context
  + Initialize session signal list in Redis
```

### /writing-plans (Modified)

```
EXISTING:
  1. Read design/spec
  2. Create implementation plan
  3. Write plan to file

NEW (Phase 1):
  + After step 2: If plan reuses known pattern → emit signal
  + Track plan structure for pattern detection
```

### /executing-plans or /subagent-driven-development (Modified)

```
EXISTING:
  1. Load plan
  2. Execute tasks
  3. Verify completion

NEW (Phase 1):
  + On task start: Load task-specific genes
  + On error recovery: emit `repair` signal
  + On repeated action: emit `pattern` signal
  + On stuck detection: emit `stuck` signal
  + On task complete: emit `completion` signal
```

### /finishing-a-development-branch (Modified)

```
EXISTING:
  1. Verify all tasks complete
  2. Run final verification
  3. Present completion options

NEW (Phase 1):
  + Before step 1: SOLIDIFY session signals into gene candidates
  + VALIDATE candidates against tiered gates
  + PROMOTE passed candidates to registry
  + Report: "Session contributed X new genes"
```

### /capability-evolver (New Skill)

```
TRIGGERS:
  /evolve                    - Show evolution status
  /evolve --solidify         - Force solidify current session
  /evolve --export           - Export to file system backup
  /evolve --publish <gene>   - Mark gene as publishable
  /evolve --prune            - Run decay/pruning

SUBMODULES:
  - signals.js     - Signal emission utilities
  - solidify.js    - Convert signals to gene candidates
  - validate.js    - Tiered validation gates
  - promote.js     - Add to registry, update Redis
  - prune.js       - Decay and removal logic
  - export.js      - Backup to file system
```

## Evolution Lifecycle

### Session Start

1. **LOAD**: Query Redis for relevant genes (top 10 by GDI score)
2. **INIT**: Create session signal list

### During Work (Passive)

- Skills emit signals as they work
- Signals stored in session list (Redis)

### Task Completion (Phase 2+)

- Quick analysis of recent signals
- If strong pattern detected → create candidate
- Available for next task in same session

### Session End

1. **SOLIDIFY**: Convert signals to gene candidates
2. **VALIDATE**: Apply tiered validation gates
3. **PROMOTE**: Add passed candidates to registry
4. **EXPORT**: Backup to file system
5. **CLEANUP**: Clear session signals

### Periodic (Daily/Weekly)

- **PRUNE**: Hybrid decay (time + performance based)

## Validation Tiers

| Tier | Gene Type | Criteria | Action |
|------|-----------|----------|--------|
| **1** | Simple patterns | successRate ≥ 0.7, used ≥ 2 times | Auto-promote |
| **2** | Complex patterns | + GDI score ≥ 0.6, impactScope ≤ 5 | Auto-promote |
| **3** | Core skills/workflows | + pass behavioral tests, manual review | Promote with audit |

## Decay Rules

| Condition | Action |
|-----------|--------|
| Unused > 7 days | Mark `status: deprecated` |
| Success rate drops < 0.5 | Demote to candidate |
| Deprecated + unused > 14 days | Remove from registry |

## File System Layout

```
# LOCAL (Personal, gitignored)
~/.claude/evolution/
├── config.yaml
├── genes/
│   ├── _private/
│   └── _publishable/
├── capsules/
│   ├── _private/
│   └── _publishable/
├── export/
│   └── snapshot-YYYYMMDD.json
└── logs/
    └── evolution.log.jsonl

# IN PUBLIC REPO (dev-workspace)
.claude/
├── evolution/
│   ├── README.md
│   ├── GEP_PROTOCOL.md
│   └── shared-genes/
│       └── README.md
├── skills/
│   └── capability-evolver/
│       ├── SKILL.md
│       └── scripts/
│           ├── signals.js
│           ├── solidify.js
│           ├── validate.js
│           ├── promote.js
│           ├── prune.js
│           └── export.js
└── references/
    └── evolution/
        ├── gene-template.md
        └── capsule-template.md
```

## Implementation Phases

### Phase 1: Foundation (Now)

**Scope**: Data structures + signal emission + session-level only

**Deliverables**:
- [ ] Create `~/.claude/evolution/` directory structure
- [ ] Create `.claude/evolution/` in repo (docs + shared-genes)
- [ ] Create `/capability-evolver` skill (basic)
- [ ] Add signal emission to existing skills:
  - `/project-session` (load genes, init session)
  - `/finishing-a-development-branch` (solidify, validate, promote)
- [ ] Redis schema setup
- [ ] Basic export/backup

**NOT included**:
- Task-level incremental learning
- Project-level federation
- Pruning/decay
- Cross-project promotion

### Phase 2: Core Complete (Future)

**Scope**: Full single-session evolution with task-level learning

**Deliverables**:
- [ ] Task-level incremental learning
- [ ] Add signal emission to `/writing-plans`, `/executing-plans`, etc.
- [ ] Full tiered validation (all 3 tiers)
- [ ] Hybrid decay (time + performance)
- [ ] Enhanced pattern detection in solidify.js

**Dependencies**: Phase 1 validated and stable

### Phase 3: Full Federation (Future)

**Scope**: Project-level evolution + cross-project promotion

**Deliverables**:
- [ ] Project-scoped gene/capsule registries
- [ ] Promotion mechanism (project → workspace)
- [ ] Cross-project gene discovery
- [ ] Shared-genes community contribution workflow
- [ ] Full A2A protocol (if needed for multi-instance)

**Dependencies**: Phase 2 validated and stable

## References

- EvoMap.ai - GEP Protocol inspiration
- LobeHub capability-evolver skill - Implementation reference
- Dev-workspace existing architecture - Integration baseline
