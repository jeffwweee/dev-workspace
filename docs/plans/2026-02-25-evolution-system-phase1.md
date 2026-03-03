# Evolution System Phase 1 Implementation Plan

> **Design:** docs/plans/2026-02-25-evolution-system-design.md
> **For Claude:** REQUIRED SUB-SKILL: Use `executing-plans` or `subagent-driven-development` skill to implement this plan task-by-task.

**Goal:** Implement the foundation for AI self-evolution in dev-workspace with Redis storage, signal emission, and session-level solidification.

**Architecture:** Redis for fast runtime access + file system for backup. Skills emit signals passively during work, solidification happens at session boundaries. All genes private by default.

**Tech Stack:** Node.js, Redis (ioredis), YAML/JSON for data files

---

## Task 1: Create Local Evolution Directory Structure

**Files:**
- Create: `~/.claude/evolution/config.yaml`
- Create: `~/.claude/evolution/genes/_private/.gitkeep`
- Create: `~/.claude/evolution/genes/_publishable/.gitkeep`
- Create: `~/.claude/evolution/capsules/_private/.gitkeep`
- Create: `~/.claude/evolution/capsules/_publishable/.gitkeep`
- Create: `~/.claude/evolution/export/.gitkeep`
- Create: `~/.claude/evolution/logs/.gitkeep`

**Step 1: Create directory structure**

Run:
```bash
mkdir -p ~/.claude/evolution/{genes/_private,genes/_publishable,capsules/_private,capsules/_publishable,export,logs}
```

**Step 2: Create config.yaml**

Create `~/.claude/evolution/config.yaml`:
```yaml
# Evolution System Configuration
version: "0.1.0"

# Redis connection
redis:
  host: "localhost"
  port: 6379
  keyPrefix: "evolution:"

# Validation thresholds
validation:
  tier1:
    minSuccessRate: 0.7
    minUsageCount: 2
  tier2:
    minGDIScore: 0.6
    maxImpactScope: 5
  tier3:
    requireBehavioralTest: true
    requireManualReview: true

# Decay settings
decay:
  deprecateAfterDays: 7
  removeAfterDays: 14
  minSuccessRateThreshold: 0.5

# Export settings
export:
  enabled: true
  intervalHours: 24
  path: "~/.claude/evolution/export"
```

**Step 3: Create gitkeep files**

Run:
```bash
touch ~/.claude/evolution/genes/_private/.gitkeep
touch ~/.claude/evolution/genes/_publishable/.gitkeep
touch ~/.claude/evolution/capsules/_private/.gitkeep
touch ~/.claude/evolution/capsules/_publishable/.gitkeep
touch ~/.claude/evolution/export/.gitkeep
touch ~/.claude/evolution/logs/.gitkeep
```

**Step 4: Verify structure**

Run:
```bash
tree ~/.claude/evolution
```

Expected output:
```
/home/<user>/.claude/evolution/
├── capsules
│   ├── _private
│   │   └── .gitkeep
│   └── _publishable
│       └── .gitkeep
├── config.yaml
├── export
│   └── .gitkeep
├── genes
│   ├── _private
│   │   └── .gitkeep
│   └── _publishable
│       └── .gitkeep
└── logs
    └── .gitkeep
```

**Step 5: Commit**

```bash
# No git commit needed - this is local user data, not in repo
```

---

## Task 2: Create Repo Evolution Directory Structure

**Files:**
- Create: `.claude/evolution/README.md`
- Create: `.claude/evolution/GEP_PROTOCOL.md`
- Create: `.claude/evolution/shared-genes/README.md`
- Create: `.claude/references/evolution/gene-template.md`
- Create: `.claude/references/evolution/capsule-template.md`

**Step 1: Create directories**

Run:
```bash
mkdir -p .claude/evolution/shared-genes
mkdir -p .claude/references/evolution
```

**Step 2: Create README.md**

Create `.claude/evolution/README.md`:
```markdown
# Evolution System

Dev-workspace's AI self-evolution infrastructure based on GEP (Genome Evolution Protocol).

## Overview

The evolution system enables Claude Code sessions to learn and improve over time by:

1. **Emitting signals** during work (patterns, repairs, completions)
2. **Solidifying** signals into gene candidates at session end
3. **Validating** candidates against quality gates
4. **Promoting** passed candidates to the gene registry
5. **Exporting** to file system for backup

## Architecture

```
Redis (Runtime)          File System (Backup)
├── Gene Registry    →   ~/.claude/evolution/genes/
├── Capsule Registry →   ~/.claude/evolution/capsules/
├── Event Stream     →   ~/.claude/evolution/logs/
└── Session Signals  →   (temporary, solidified at session end)
```

## Quick Start

The evolution system is automatically integrated with your workflow:

- **Session start**: Genes loaded into context
- **During work**: Skills emit signals passively
- **Session end**: Signals solidified into new genes

### Manual Commands

```bash
/evolve                    # Show evolution status
/evolve --solidify         # Force solidify current session
/evolve --export           # Export to file system backup
/evolve --publish <gene>   # Mark gene as publishable
```

## Sharing Genes

By default, all genes are private (stored in `~/.claude/evolution/genes/_private/`).

To share a gene with the community:
1. Mark it as publishable: `/evolve --publish <gene-id>`
2. It will be copied to `genes/_publishable/`
3. Submit a PR to contribute it to `shared-genes/`

## Files

| File | Purpose |
|------|---------|
| `GEP_PROTOCOL.md` | Protocol specification |
| `shared-genes/` | Community-contributed genes |

## Configuration

Edit `~/.claude/evolution/config.yaml` to customize:
- Redis connection settings
- Validation thresholds
- Decay settings
- Export schedule
```

**Step 3: Create GEP_PROTOCOL.md**

Create `.claude/evolution/GEP_PROTOCOL.md`:
```markdown
# GEP Protocol Specification

Genome Evolution Protocol (GEP) for dev-workspace AI self-evolution.

## Core Concepts

### Gene

Atomic capability unit - the smallest reusable piece of knowledge.

```yaml
id: gene-20260225-a1b2c3d4
type: pattern | prompt | config | workflow
name: "Descriptive name"
description: "What this gene does"
content: |
  The actual capability content
metadata:
  successRate: 0.85
  usageCount: 12
```

### Capsule

Complete task execution path - a composite of genes that solved a specific problem.

```yaml
id: cap-20260225-e5f6a7b8
name: "Task name"
genes:
  - gene-20260225-xxx
executionPath:
  - step: 1
    action: "Description"
validation:
  confidence: 0.92
```

### Signal

Event emitted during work that may lead to gene creation.

| Type | When Emitted |
|------|--------------|
| `pattern` | Repeated action detected |
| `repair` | Error successfully recovered |
| `innovation` | Novel solution worked |
| `completion` | Task completed |
| `interrupted` | User interrupted |
| `timeout` | Operation timed out |
| `stuck` | Review loop or internal error |

## Lifecycle

```
1. SIGNAL    → Emit during work
2. SOLIDIFY  → Convert signals to gene candidates (session end)
3. VALIDATE  → Apply quality gates
4. PROMOTE   → Add to registry
5. USE       → Load in future sessions
6. DECAY     → Prune if unused/underperforming
```

## Validation Tiers

| Tier | Criteria | Auto-Promote |
|------|----------|--------------|
| 1 | successRate ≥ 0.7, usage ≥ 2 | Yes |
| 2 | + GDI ≥ 0.6, impact ≤ 5 files | Yes |
| 3 | + behavioral tests, review | With audit |

## Decay Rules

| Condition | Action |
|-----------|--------|
| Unused > 7 days | Mark deprecated |
| Success rate < 0.5 | Demote to candidate |
| Deprecated + unused > 14 days | Remove |

## Redis Schema

```
evolution:genes:registry          # Sorted Set (GDI score)
evolution:gene:{id}               # Hash (gene data)
evolution:capsules:registry       # Set
evolution:capsule:{id}            # Hash
evolution:events                  # List (JSONL)
evolution:session:{id}:signals    # List (temporary)
evolution:publishable             # Set (gene IDs)
```
```

**Step 4: Create shared-genes README**

Create `.claude/evolution/shared-genes/README.md`:
```markdown
# Shared Genes

Community-contributed genes for dev-workspace evolution system.

## How to Contribute

1. Create a gene in your local workspace
2. Mark it as publishable: `/evolve --publish <gene-id>`
3. Copy from `~/.claude/evolution/genes/_publishable/` to this directory
4. Submit a PR

## Gene Format

See [gene-template.md](../references/evolution/gene-template.md) for the standard format.

## Naming Convention

```
gene-YYYYMMDD-hash8.md
```

Example: `gene-20260225-a1b2c3d4.md`

## Review Process

All contributed genes are reviewed for:
- [ ] Clear, actionable content
- [ ] Valid YAML frontmatter
- [ ] Applicable to general use cases
- [ ] No project-specific or sensitive information
```

**Step 5: Create gene template**

Create `.claude/references/evolution/gene-template.md`:
```markdown
---
id: gene-YYYYMMDD-hash8
type: pattern | prompt | config | workflow
name: "Gene Name"
description: "Brief description of what this gene does"
version: 1
publishable: false
---

# Gene: [Name]

## Content

```
[The actual capability - can be instructions, code patterns, configurations, etc.]
```

## Metadata

| Field | Value |
|-------|-------|
| Created | YYYY-MM-DD |
| Success Rate | 0.00 |
| Usage Count | 0 |

## Context

**Applicable Scenarios:**
- Scenario 1
- Scenario 2

**Tags:** tag1, tag2, tag3

## Mutation History

| Version | Change | Reason |
|---------|--------|--------|
| 1 | Initial | - |
```

**Step 6: Create capsule template**

Create `.claude/references/evolution/capsule-template.md`:
```markdown
---
id: cap-YYYYMMDD-hash8
name: "Capsule Name"
description: "Brief description of the task this capsule solves"
genes:
  - gene-xxx
scope: project | workspace
publishable: false
---

# Capsule: [Name]

## Genes Used

| Gene | Purpose |
|------|---------|
| gene-xxx | Why this gene was used |

## Execution Path

1. **Step 1**: Description
   - Action taken
   - Outcome

2. **Step 2**: Description
   - Action taken
   - Outcome

## Validation

| Metric | Value |
|--------|-------|
| Confidence | 0.00 |
| Impact Scope | 0 files |
| Test Pass Rate | 0% |

## Audit Log

| Timestamp | Event | Session |
|-----------|-------|---------|
| YYYY-MM-DD | created | SESS-XXX |
```

**Step 7: Verify structure**

Run:
```bash
tree .claude/evolution .claude/references/evolution
```

Expected output:
```
.claude/evolution/
├── GEP_PROTOCOL.md
├── README.md
└── shared-genes/
    └── README.md
.claude/references/evolution/
├── capsule-template.md
└── gene-template.md
```

**Step 8: Commit**

```bash
git add .claude/evolution .claude/references/evolution
git commit -m "$(cat <<'EOF'
feat(evolution): Add evolution system directory structure

- Add README.md with overview and quick start guide
- Add GEP_PROTOCOL.md with protocol specification
- Add shared-genes directory for community contributions
- Add gene-template.md and capsule-template.md references

Phase 1 foundation for AI self-evolution infrastructure.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Install Redis Client Dependency

**Files:**
- Modify: `package.json`

**Step 1: Check if ioredis is already installed**

Run:
```bash
npm list ioredis 2>/dev/null || echo "not installed"
```

**Step 2: Install ioredis if needed**

Run:
```bash
npm install ioredis --save
```

Expected output:
```
added 1 package in Xs
```

**Step 3: Verify installation**

Run:
```bash
npm list ioredis
```

Expected output:
```
dev-workspace@X.X.X /path/to/dev-workspace
└── ioredis@X.X.X
```

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "$(cat <<'EOF'
chore: Add ioredis dependency for evolution system

Required for Redis-based gene and signal storage.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Create capability-evolver Skill

**Files:**
- Create: `.claude/skills/capability-evolver/SKILL.md`
- Create: `.claude/skills/capability-evolver/scripts/redis.js`
- Create: `.claude/skills/capability-evolver/scripts/signals.js`
- Create: `.claude/skills/capability-evolver/scripts/solidify.js`
- Create: `.claude/skills/capability-evolver/scripts/validate.js`
- Create: `.claude/skills/capability-evolver/scripts/promote.js`
- Create: `.claude/skills/capability-evolver/scripts/export.js`

**Step 1: Create skill directory**

Run:
```bash
mkdir -p .claude/skills/capability-evolver/scripts
```

**Step 2: Create SKILL.md**

Create `.claude/skills/capability-evolver/SKILL.md`:
```markdown
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

### `--status <session-id>`: Session Status

```bash
/evolve --status SESS-001
```

Shows signals and gene candidates for a specific session.

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

**Can be called manually:**
- User runs `/evolve` to check status
- User runs `/evolve --export` for backup

## Return Contract

See [return-contract.md](../references/return-contract.md).

## Safety Rules

1. **NEVER auto-delete genes** - Only mark as deprecated, removal requires explicit action
2. **ALWAYS validate before promote** - Never bypass validation gates
3. **NEVER modify genes directly** - Use mutation process with audit trail
4. **ALWAYS export before major changes** - Backup first

## Error Handling

- **Redis connection failed**: Check if Redis is running (`redis-cli ping`)
- **Session not found**: Session may have expired (24h TTL)
- **Gene not found**: Check gene ID format (gene-YYYYMMDD-hash8)

## Example: Show Status

```
User: /evolve

Evolution Status
================

Registry:
- Genes: 12
- Capsules: 3
- Publishable: 1

Active Sessions:
- SESS-001: 5 signals, 2 candidates

Top Genes (by GDI):
1. gene-20260225-abc (0.92) - "Error retry pattern"
2. gene-20260224-xyz (0.87) - "API caching strategy"

Recent Events:
- 2026-02-25 10:00 - Gene promoted: gene-20260225-abc
- 2026-02-25 09:30 - Session solidified: SESS-001

Status: SUCCESS

Next recommended:
- Continue with your current task
- Run /evolve --export to backup
```

## Example: Solidify Session

```
User: /evolve --solidify

Solidifying session SESS-001...

Signals analyzed: 8
Patterns detected: 2
  - error-retry (count: 3, success: 100%)
  - api-caching (count: 2, success: 100%)

Gene candidates created: 2
  - gene-20260225-new1 (confidence: 0.85)
  - gene-20260225-new2 (confidence: 0.72)

Validation:
  - gene-20260225-new1: PASSED (tier 1)
  - gene-20260225-new2: FAILED (success rate too low)

Promoted: 1 gene

Status: SUCCESS

Files changed:
- Redis: gene-20260225-new1 added to registry
- ~/.claude/evolution/genes/_private/gene-20260225-new1.md

Next recommended:
- Continue to finishing-a-development-branch
```
```

**Step 3: Create redis.js**

Create `.claude/skills/capability-evolver/scripts/redis.js`:
```javascript
/**
 * Redis client for evolution system
 * Provides connection management and key helpers
 */

const Redis = require('ioredis');
const fs = require('fs');
const path = require('path');
const os = require('os');

let client = null;

/**
 * Load config from ~/.claude/evolution/config.yaml
 */
function loadConfig() {
  const configPath = path.join(os.homedir(), '.claude', 'evolution', 'config.yaml');

  if (!fs.existsSync(configPath)) {
    return {
      redis: { host: 'localhost', port: 6379, keyPrefix: 'evolution:' }
    };
  }

  const yaml = fs.readFileSync(configPath, 'utf8');
  // Simple YAML parsing for our config format
  const config = { redis: {} };
  const lines = yaml.split('\n');
  let inRedis = false;

  for (const line of lines) {
    if (line.startsWith('redis:')) {
      inRedis = true;
      continue;
    }
    if (inRedis && line.startsWith('  ')) {
      const [key, value] = line.trim().split(': ').map(s => s.replace(/"/g, ''));
      if (key === 'port') {
        config.redis[key] = parseInt(value);
      } else {
        config.redis[key] = value;
      }
    } else if (inRedis && !line.startsWith('  ') && !line.startsWith('#')) {
      inRedis = false;
    }
  }

  return config;
}

/**
 * Get or create Redis client
 */
async function getClient() {
  if (client && client.status === 'ready') {
    return client;
  }

  const config = loadConfig();

  client = new Redis({
    host: config.redis.host || 'localhost',
    port: config.redis.port || 6379,
    keyPrefix: config.redis.keyPrefix || 'evolution:',
    lazyConnect: true
  });

  await client.connect();
  return client;
}

/**
 * Close Redis connection
 */
async function close() {
  if (client) {
    await client.quit();
    client = null;
  }
}

/**
 * Key helpers
 */
const keys = {
  genesRegistry: () => 'genes:registry',
  gene: (id) => `gene:${id}`,
  geneMetadata: (id) => `gene:${id}:metadata`,
  capsulesRegistry: () => 'capsules:registry',
  capsule: (id) => `capsule:${id}`,
  events: () => 'events',
  sessionSignals: (sessionId) => `session:${sessionId}:signals`,
  sessionState: (sessionId) => `session:${sessionId}:state`,
  activeSessions: () => 'sessions:active',
  publishable: () => 'publishable',
  pendingPromotion: () => 'pending:promotion',
  projectGenes: (projectId) => `project:${projectId}:genes`,
  projectCapsules: (projectId) => `project:${projectId}:capsules`
};

module.exports = {
  getClient,
  close,
  keys,
  loadConfig
};
```

**Step 4: Create signals.js**

Create `.claude/skills/capability-evolver/scripts/signals.js`:
```javascript
/**
 * Signal emission utilities
 */

const redis = require('./redis');

/**
 * Signal types
 */
const SIGNAL_TYPES = {
  PATTERN: 'pattern',
  REPAIR: 'repair',
  INNOVATION: 'innovation',
  COMPLETION: 'completion',
  INTERRUPTED: 'interrupted',
  TIMEOUT: 'timeout',
  STUCK: 'stuck',
  USE: 'use'
};

/**
 * Emit a signal
 * @param {string} type - Signal type from SIGNAL_TYPES
 * @param {object} data - Signal data
 * @param {string} sessionId - Session ID
 */
async function emit(type, data, sessionId) {
  const client = await redis.getClient();

  const signal = {
    ts: new Date().toISOString(),
    type: 'signal',
    category: type,
    session: sessionId,
    data
  };

  const signalJson = JSON.stringify(signal);

  // Add to session signals list
  await client.lpush(redis.keys.sessionSignals(sessionId), signalJson);

  // Add to global events stream
  await client.lpush(redis.keys.events(), signalJson);

  // Set TTL on session signals (24 hours)
  await client.expire(redis.keys.sessionSignals(sessionId), 86400);

  return signal;
}

/**
 * Get all signals for a session
 * @param {string} sessionId - Session ID
 * @returns {Array} Array of signal objects
 */
async function getSessionSignals(sessionId) {
  const client = await redis.getClient();

  const signals = await client.lrange(redis.keys.sessionSignals(sessionId), 0, -1);
  return signals.map(s => JSON.parse(s)).reverse();
}

/**
 * Clear session signals
 * @param {string} sessionId - Session ID
 */
async function clearSessionSignals(sessionId) {
  const client = await redis.getClient();
  await client.del(redis.keys.sessionSignals(sessionId));
}

/**
 * Get recent global events
 * @param {number} limit - Number of events to retrieve
 * @returns {Array} Array of event objects
 */
async function getRecentEvents(limit = 50) {
  const client = await redis.getClient();

  const events = await client.lrange(redis.keys.events(), 0, limit - 1);
  return events.map(e => JSON.parse(e));
}

/**
 * Initialize session for evolution tracking
 * @param {string} sessionId - Session ID
 * @param {object} context - Session context (project, task, etc.)
 */
async function initSession(sessionId, context = {}) {
  const client = await redis.getClient();

  // Add to active sessions
  await client.sadd(redis.keys.activeSessions(), sessionId);

  // Set session state
  await client.hset(redis.keys.sessionState(sessionId), {
    startedAt: new Date().toISOString(),
    ...context
  });

  // Set TTL on session state (48 hours)
  await client.expire(redis.keys.sessionState(sessionId), 172800);

  // Emit session start event
  await emit('completion', { action: 'session-start', context }, sessionId);
}

module.exports = {
  SIGNAL_TYPES,
  emit,
  getSessionSignals,
  clearSessionSignals,
  getRecentEvents,
  initSession
};
```

**Step 5: Create solidify.js**

Create `.claude/skills/capability-evolver/scripts/solidify.js`:
```javascript
/**
 * Solidification - Convert signals to gene candidates
 */

const redis = require('./redis');
const signals = require('./signals');
const crypto = require('crypto');

/**
 * Analyze signals and extract patterns
 * @param {Array} sessionSignals - Array of signals from a session
 * @returns {Array} Array of gene candidates
 */
function analyzeSignals(sessionSignals) {
  const candidates = [];
  const patterns = {};

  // Group signals by type
  for (const signal of sessionSignals) {
    if (signal.category === 'pattern') {
      const key = signal.data.pattern || 'unknown';
      if (!patterns[key]) {
        patterns[key] = { count: 0, successes: 0, contexts: [] };
      }
      patterns[key].count++;
      if (signal.data.success !== false) {
        patterns[key].successes++;
      }
      patterns[key].contexts.push(signal.data);
    }
  }

  // Convert patterns to candidates
  for (const [patternName, data] of Object.entries(patterns)) {
    if (data.count >= 2) { // At least 2 occurrences
      const successRate = data.successes / data.count;
      candidates.push({
        id: generateGeneId(),
        type: 'pattern',
        name: patternName,
        description: `Pattern detected from session signals`,
        content: extractContent(patternName, data.contexts),
        metadata: {
          successRate,
          usageCount: data.count,
          createdAt: new Date().toISOString(),
          lastUsed: new Date().toISOString()
        },
        source: 'solidification',
        confidence: Math.min(successRate * (data.count / 5), 1) // Scale by frequency
      });
    }
  }

  // Extract repair patterns
  const repairs = sessionSignals.filter(s => s.category === 'repair' && s.data.success);
  for (const repair of repairs) {
    candidates.push({
      id: generateGeneId(),
      type: 'pattern',
      name: `repair-${repair.data.error || 'unknown'}`,
      description: `Error recovery pattern: ${repair.data.fix}`,
      content: `When encountering ${repair.data.error}, apply fix: ${repair.data.fix}`,
      metadata: {
        successRate: 1.0,
        usageCount: 1,
        createdAt: new Date().toISOString(),
        lastUsed: new Date().toISOString()
      },
      source: 'solidification',
      confidence: 0.6
    });
  }

  return candidates;
}

/**
 * Generate a gene ID
 */
function generateGeneId() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const hash = crypto.randomBytes(4).toString('hex');
  return `gene-${date}-${hash}`;
}

/**
 * Extract content from pattern contexts
 */
function extractContent(patternName, contexts) {
  // Simple extraction - in Phase 2 this could use LLM
  const examples = contexts.slice(0, 3).map(c => JSON.stringify(c)).join('\n');
  return `Pattern: ${patternName}\n\nExamples:\n${examples}`;
}

/**
 * Solidify session signals into gene candidates
 * @param {string} sessionId - Session ID
 * @returns {object} Solidification result
 */
async function solidify(sessionId) {
  const client = await redis.getClient();

  // Get session signals
  const sessionSignals = await signals.getSessionSignals(sessionId);

  if (sessionSignals.length === 0) {
    return {
      success: true,
      signalsAnalyzed: 0,
      candidates: [],
      message: 'No signals to solidify'
    };
  }

  // Analyze and extract patterns
  const candidates = analyzeSignals(sessionSignals);

  // Store candidates in session state
  await client.hset(redis.keys.sessionState(sessionId), {
    candidates: JSON.stringify(candidates),
    solidifiedAt: new Date().toISOString()
  });

  // Emit solidification event
  const event = {
    ts: new Date().toISOString(),
    type: 'solidify',
    session: sessionId,
    data: {
      signalsAnalyzed: sessionSignals.length,
      candidatesCreated: candidates.length
    }
  };
  await client.lpush(redis.keys.events(), JSON.stringify(event));

  return {
    success: true,
    signalsAnalyzed: sessionSignals.length,
    candidates,
    message: `Created ${candidates.length} gene candidates from ${sessionSignals.length} signals`
  };
}

module.exports = {
  solidify,
  analyzeSignals,
  generateGeneId
};
```

**Step 6: Create validate.js**

Create `.claude/skills/capability-evolver/scripts/validate.js`:
```javascript
/**
 * Validation gates for gene candidates
 */

const redis = require('./redis');

/**
 * Validation tiers
 */
const TIERS = {
  TIER1: {
    name: 'simple',
    minSuccessRate: 0.7,
    minUsageCount: 2
  },
  TIER2: {
    name: 'complex',
    minGDIScore: 0.6,
    maxImpactScope: 5,
    requiresTier1: true
  },
  TIER3: {
    name: 'core',
    requireBehavioralTest: true,
    requireManualReview: true,
    requiresTier2: true
  }
};

/**
 * Validate a gene candidate against tier 1 criteria
 * @param {object} candidate - Gene candidate
 * @returns {object} Validation result
 */
function validateTier1(candidate) {
  const errors = [];

  if (candidate.metadata.successRate < TIERS.TIER1.minSuccessRate) {
    errors.push(`Success rate ${candidate.metadata.successRate} < ${TIERS.TIER1.minSuccessRate}`);
  }

  if (candidate.metadata.usageCount < TIERS.TIER1.minUsageCount) {
    errors.push(`Usage count ${candidate.metadata.usageCount} < ${TIERS.TIER1.minUsageCount}`);
  }

  return {
    passed: errors.length === 0,
    tier: 1,
    errors,
    confidence: candidate.confidence || candidate.metadata.successRate
  };
}

/**
 * Calculate GDI (Global Desirability Index) score
 * @param {object} gene - Gene with metadata
 * @returns {number} GDI score 0-1
 */
function calculateGDI(gene) {
  const metadata = gene.metadata || {};

  // Weights from design
  const weights = {
    quality: 0.35,
    usage: 0.30,
    social: 0.20,
    freshness: 0.15
  };

  // Quality score (success rate)
  const qualityScore = metadata.successRate || 0;

  // Usage score (normalized by log scale)
  const usageScore = Math.min(Math.log10((metadata.usageCount || 0) + 1) / 2, 1);

  // Social score (placeholder - would be citations/references)
  const socialScore = metadata.socialScore || 0.5;

  // Freshness score (based on last used)
  let freshnessScore = 0.5;
  if (metadata.lastUsed) {
    const daysSinceUse = (Date.now() - new Date(metadata.lastUsed).getTime()) / 86400000;
    freshnessScore = Math.max(0, 1 - (daysSinceUse / 30)); // Decay over 30 days
  }

  return (
    weights.quality * qualityScore +
    weights.usage * usageScore +
    weights.social * socialScore +
    weights.freshness * freshnessScore
  );
}

/**
 * Validate a gene candidate
 * @param {object} candidate - Gene candidate
 * @param {number} targetTier - Target validation tier (1, 2, or 3)
 * @returns {object} Validation result
 */
function validate(candidate, targetTier = 1) {
  // Always check tier 1
  const tier1Result = validateTier1(candidate);

  if (targetTier === 1) {
    return {
      ...tier1Result,
      gdiScore: calculateGDI(candidate)
    };
  }

  // Tier 2 adds GDI check
  if (targetTier >= 2) {
    const gdiScore = calculateGDI(candidate);
    const tier2Errors = [...tier1Result.errors];

    if (gdiScore < TIERS.TIER2.minGDIScore) {
      tier2Errors.push(`GDI score ${gdiScore.toFixed(2)} < ${TIERS.TIER2.minGDIScore}`);
    }

    if ((candidate.impactScope || 0) > TIERS.TIER2.maxImpactScope) {
      tier2Errors.push(`Impact scope ${candidate.impactScope} > ${TIERS.TIER2.maxImpactScope}`);
    }

    if (!tier1Result.passed) {
      tier2Errors.unshift('Tier 1 validation failed');
    }

    return {
      passed: tier2Errors.length === 0,
      tier: 2,
      errors: tier2Errors,
      confidence: candidate.confidence || gdiScore,
      gdiScore
    };
  }

  // Tier 3 would require behavioral tests and manual review
  // For Phase 1, we just return tier 2 result
  return validate(candidate, 2);
}

/**
 * Validate all candidates from a session
 * @param {string} sessionId - Session ID
 * @returns {object} Validation results
 */
async function validateSessionCandidates(sessionId) {
  const client = await redis.getClient();

  // Get candidates from session state
  const sessionState = await client.hgetall(redis.keys.sessionState(sessionId));

  if (!sessionState.candidates) {
    return {
      success: true,
      validated: 0,
      passed: [],
      failed: []
    };
  }

  const candidates = JSON.parse(sessionState.candidates);
  const passed = [];
  const failed = [];

  for (const candidate of candidates) {
    const result = validate(candidate, 1); // Phase 1: Tier 1 only

    if (result.passed) {
      passed.push({ candidate, result });
    } else {
      failed.push({ candidate, result });
    }
  }

  // Emit validation event
  const event = {
    ts: new Date().toISOString(),
    type: 'validate',
    session: sessionId,
    data: {
      validated: candidates.length,
      passed: passed.length,
      failed: failed.length
    }
  };
  await client.lpush(redis.keys.events(), JSON.stringify(event));

  return {
    success: true,
    validated: candidates.length,
    passed,
    failed
  };
}

module.exports = {
  validate,
  validateTier1,
  validateSessionCandidates,
  calculateGDI,
  TIERS
};
```

**Step 7: Create promote.js**

Create `.claude/skills/capability-evolver/scripts/promote.js`:
```javascript
/**
 * Promote gene candidates to registry
 */

const redis = require('./redis');
const validate = require('./validate');

/**
 * Promote a single gene to the registry
 * @param {object} gene - Gene to promote
 * @param {object} options - Promotion options
 */
async function promoteGene(gene, options = {}) {
  const client = await redis.getClient();

  const geneId = gene.id;
  const gdiScore = validate.calculateGDI(gene);

  // Store gene data
  await client.hset(redis.keys.gene(geneId), {
    id: geneId,
    type: gene.type || 'pattern',
    name: gene.name,
    description: gene.description || '',
    content: gene.content,
    version: gene.version || 1,
    publishable: gene.publishable || false,
    source: gene.source || 'session',
    scope: options.scope || 'workspace',
    projectId: options.projectId || '',
    createdAt: gene.metadata?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  // Store metadata separately
  await client.hset(redis.keys.geneMetadata(geneId), {
    successRate: gene.metadata?.successRate || 0,
    usageCount: gene.metadata?.usageCount || 0,
    lastUsed: gene.metadata?.lastUsed || new Date().toISOString(),
    consecutiveSuccesses: gene.metadata?.consecutiveSuccesses || 0,
    consecutiveFailures: 0,
    gdiScore: gdiScore.toString()
  });

  // Add to registry with GDI score
  await client.zadd(redis.keys.genesRegistry(), gdiScore, geneId);

  return { geneId, gdiScore };
}

/**
 * Promote all validated candidates from a session
 * @param {string} sessionId - Session ID
 * @returns {object} Promotion result
 */
async function promoteSessionCandidates(sessionId) {
  const client = await redis.getClient();

  // Get validated candidates
  const validationResult = await validate.validateSessionCandidates(sessionId);

  if (validationResult.passed.length === 0) {
    return {
      success: true,
      promoted: 0,
      genes: [],
      message: 'No candidates passed validation'
    };
  }

  const promoted = [];

  for (const { candidate } of validationResult.passed) {
    try {
      const result = await promoteGene(candidate);
      promoted.push(result);

      // Emit promotion event
      const event = {
        ts: new Date().toISOString(),
        type: 'promote',
        session: sessionId,
        data: {
          geneId: result.geneId,
          gdiScore: result.gdiScore
        }
      };
      await client.lpush(redis.keys.events(), JSON.stringify(event));
    } catch (error) {
      console.error(`Failed to promote ${candidate.id}:`, error.message);
    }
  }

  return {
    success: true,
    promoted: promoted.length,
    genes: promoted,
    message: `Promoted ${promoted.length} genes to registry`
  };
}

/**
 * Get top genes by GDI score
 * @param {number} limit - Number of genes to retrieve
 * @returns {Array} Array of gene objects with scores
 */
async function getTopGenes(limit = 10) {
  const client = await redis.getClient();

  // Get top gene IDs by score (descending)
  const geneIds = await client.zrevrange(redis.keys.genesRegistry(), 0, limit - 1, 'WITHSCORES');

  const genes = [];
  for (let i = 0; i < geneIds.length; i += 2) {
    const geneId = geneIds[i];
    const score = parseFloat(geneIds[i + 1]);

    const geneData = await client.hgetall(redis.keys.gene(geneId));
    const metadata = await client.hgetall(redis.keys.geneMetadata(geneId));

    genes.push({
      id: geneId,
      ...geneData,
      metadata,
      gdiScore: score
    });
  }

  return genes;
}

/**
 * Record gene usage
 * @param {string} geneId - Gene ID
 * @param {boolean} success - Whether usage was successful
 */
async function recordUsage(geneId, success = true) {
  const client = await redis.getClient();

  const metadata = await client.hgetall(redis.keys.geneMetadata(geneId));

  const usageCount = parseInt(metadata.usageCount || 0) + 1;
  const successCount = parseInt(metadata.successCount || 0) + (success ? 1 : 0);
  const consecutiveSuccesses = success ? parseInt(metadata.consecutiveSuccesses || 0) + 1 : 0;
  const consecutiveFailures = success ? 0 : parseInt(metadata.consecutiveFailures || 0) + 1;

  const successRate = successCount / usageCount;

  await client.hset(redis.keys.geneMetadata(geneId), {
    usageCount: usageCount.toString(),
    successCount: successCount.toString(),
    successRate: successRate.toFixed(2),
    consecutiveSuccesses: consecutiveSuccesses.toString(),
    consecutiveFailures: consecutiveFailures.toString(),
    lastUsed: new Date().toISOString()
  });

  // Update GDI score
  const geneData = await client.hgetall(redis.keys.gene(geneId));
  const newGDI = validate.calculateGDI({
    metadata: {
      successRate,
      usageCount,
      lastUsed: new Date().toISOString()
    }
  });

  await client.zadd(redis.keys.genesRegistry(), newGDI, geneId);
}

module.exports = {
  promoteGene,
  promoteSessionCandidates,
  getTopGenes,
  recordUsage
};
```

**Step 8: Create export.js**

Create `.claude/skills/capability-evolver/scripts/export.js`:
```javascript
/**
 * Export evolution data to file system
 */

const redis = require('./redis');
const promote = require('./promote');
const fs = require('fs');
const path = require('path');
const os = require('os');

const EVOLUTION_DIR = path.join(os.homedir(), '.claude', 'evolution');

/**
 * Export all genes to file system
 * @returns {object} Export result
 */
async function exportGenes() {
  const client = await redis.getClient();

  // Get all gene IDs
  const geneIds = await client.zrange(redis.keys.genesRegistry(), 0, -1);

  const exported = [];
  const privateDir = path.join(EVOLUTION_DIR, 'genes', '_private');
  const publishableDir = path.join(EVOLUTION_DIR, 'genes', '_publishable');

  for (const geneId of geneIds) {
    const geneData = await client.hgetall(redis.keys.gene(geneId));
    const metadata = await client.hgetall(redis.keys.geneMetadata(geneId));

    const gene = {
      id: geneId,
      ...geneData,
      metadata
    };

    // Create markdown file
    const content = geneToMarkdown(gene);
    const targetDir = gene.publishable === 'true' ? publishableDir : privateDir;
    const filePath = path.join(targetDir, `${geneId}.md`);

    fs.writeFileSync(filePath, content, 'utf8');
    exported.push({ geneId, path: filePath });
  }

  return {
    success: true,
    exported: exported.length,
    genes: exported
  };
}

/**
 * Convert gene to markdown format
 */
function geneToMarkdown(gene) {
  return `---
id: ${gene.id}
type: ${gene.type || 'pattern'}
name: "${gene.name || 'Unnamed'}"
description: "${gene.description || ''}"
version: ${gene.version || 1}
publishable: ${gene.publishable || false}
---

# Gene: ${gene.name || gene.id}

## Content

\`\`\`
${gene.content || ''}
\`\`\`

## Metadata

| Field | Value |
|-------|-------|
| Created | ${gene.createdAt || 'unknown'} |
| Success Rate | ${gene.metadata?.successRate || 0} |
| Usage Count | ${gene.metadata?.usageCount || 0} |
| GDI Score | ${gene.metadata?.gdiScore || 0} |

## Context

**Source:** ${gene.source || 'unknown'}
**Scope:** ${gene.scope || 'workspace'}

## Tags

${gene.tags || 'none'}
`;
}

/**
 * Create snapshot of all Redis data
 * @returns {object} Export result
 */
async function createSnapshot() {
  const client = await redis.getClient();

  const date = new Date().toISOString().slice(0, 10);
  const snapshotPath = path.join(EVOLUTION_DIR, 'export', `snapshot-${date}.json`);

  // Get all genes
  const geneIds = await client.zrange(redis.keys.genesRegistry(), 0, -1, 'WITHSCORES');
  const genes = {};

  for (let i = 0; i < geneIds.length; i += 2) {
    const geneId = geneIds[i];
    const score = geneIds[i + 1];
    genes[geneId] = {
      data: await client.hgetall(redis.keys.gene(geneId)),
      metadata: await client.hgetall(redis.keys.geneMetadata(geneId)),
      gdiScore: score
    };
  }

  // Get recent events
  const events = await client.lrange(redis.keys.events(), 0, 99);

  // Get publishable genes
  const publishable = await client.smembers(redis.keys.publishable());

  const snapshot = {
    version: '0.1.0',
    exportedAt: new Date().toISOString(),
    genes,
    events: events.map(e => JSON.parse(e)),
    publishable
  };

  fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf8');

  return {
    success: true,
    path: snapshotPath,
    genesExported: Object.keys(genes).length,
    eventsExported: events.length
  };
}

/**
 * Full export (genes + snapshot)
 */
async function exportAll() {
  const genesResult = await exportGenes();
  const snapshotResult = await createSnapshot();

  return {
    success: true,
    genes: genesResult,
    snapshot: snapshotResult
  };
}

module.exports = {
  exportGenes,
  exportAll,
  createSnapshot,
  geneToMarkdown
};
```

**Step 9: Verify scripts**

Run:
```bash
ls -la .claude/skills/capability-evolver/scripts/
```

Expected output:
```
total 24
drwxr-xr-x 1 user user 4096 Feb 25 10:00 .
drwxr-xr-x 1 user user 4096 Feb 25 10:00 ..
-rw-r--r-- 1 user user 1234 Feb 25 10:00 export.js
-rw-r--r-- 1 user user 2345 Feb 25 10:00 promote.js
-rw-r--r-- 1 user user 3456 Feb 25 10:00 redis.js
-rw-r--r-- 1 user user 4567 Feb 25 10:00 signals.js
-rw-r--r-- 1 user user 5678 Feb 25 10:00 solidify.js
-rw-r--r-- 1 user user 6789 Feb 25 10:00 validate.js
```

**Step 10: Commit**

```bash
git add .claude/skills/capability-evolver
git commit -m "$(cat <<'EOF'
feat(evolution): Add capability-evolver skill

New skill for AI self-evolution with:
- redis.js: Redis client and key helpers
- signals.js: Signal emission utilities
- solidify.js: Convert signals to gene candidates
- validate.js: Tiered validation gates
- promote.js: Add genes to registry
- export.js: Backup to file system

Implements Phase 1 foundation for evolution system.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Modify project-session to Load Genes

**Files:**
- Modify: `.claude/skills/project-session/SKILL.md`

**Step 1: Read current SKILL.md**

The current SKILL.md is already read. We need to add evolution integration at session start.

**Step 2: Add evolution section to SKILL.md**

After the "Usage Modes" section, add a new section before "Multi-Session Workflow":

```markdown
## Evolution Integration

At session start, the evolution system loads relevant genes into context:

### Automatic Loading

When a session is initialized:
1. Query Redis for top genes by GDI score
2. Match genes to project context (tags, scenarios)
3. Include matching genes in session context
4. Initialize session signal list for tracking

### Manual Commands

```bash
/evolve              # Show loaded genes and evolution status
/evolve --status     # Detailed session evolution state
```

### Integration Point

After claiming a task, the skill should:
1. Load relevant genes from Redis
2. Initialize session signals in Redis
3. Include genes in context for subsequent skills
```

**Step 3: Modify the SKILL.md**

Use Edit to add the evolution integration section after line 38 (after "Without flags, continue with the most recently active session."):

```markdown
## Evolution Integration

At session start, the evolution system loads relevant genes into context:

### Automatic Loading

When a session is initialized:
1. Query Redis for top genes by GDI score
2. Match genes to project context (tags, scenarios)
3. Include matching genes in session context
4. Initialize session signal list for tracking

### Integration Point

After Step 3 (Load project context) in the workflow, add:

```bash
# Evolution: Load genes
node -e "require('./.claude/skills/capability-evolver/scripts/promote').getTopGenes(5).then(genes => console.log(JSON.stringify(genes, null, 2)))"

# Evolution: Init session
node -e "require('./.claude/skills/capability-evolver/scripts/signals').initSession(process.env.CLAUDE_SESSION_ID || 'local', {project: '<project-name>'})"
```
```

**Step 4: Commit**

```bash
git add .claude/skills/project-session/SKILL.md
git commit -m "$(cat <<'EOF'
feat(evolution): Add gene loading to project-session

Adds evolution integration at session start:
- Load top genes by GDI score
- Initialize session signal list
- Include genes in session context

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Modify finishing-a-development-branch for Solidification

**Files:**
- Modify: `.claude/skills/finishing-a-development-branch/SKILL.md`

**Step 1: Read current SKILL.md**

The current SKILL.md is already read. We need to add solidification before Step 1 (Verify Tests).

**Step 2: Add evolution section to SKILL.md**

Add a new section before "The Process":

```markdown
## Evolution Integration

At session end, solidify signals into genes:

### Pre-Completion: Solidify Session

Before verifying tests, run solidification:

```bash
# Evolution: Solidify session signals
node -e "
const solidify = require('./.claude/skills/capability-evolver/scripts/solidify');
const promote = require('./.claude/skills/capability-evolver/scripts/promote');
const exportModule = require('./.claude/skills/capability-evolver/scripts/export');

async function finish() {
  const sessionId = process.env.CLAUDE_SESSION_ID || 'local';

  // Solidify
  const solidified = await solidify.solidify(sessionId);
  console.log('Solidified:', solidified.message);

  // Promote
  const promoted = await promote.promoteSessionCandidates(sessionId);
  console.log('Promoted:', promoted.message);

  // Export
  const exported = await exportModule.exportAll();
  console.log('Exported:', exported.genes.exported, 'genes');
}

finish().catch(console.error);
"
```

This reports: "Session contributed X new genes"
```

**Step 3: Commit**

```bash
git add .claude/skills/finishing-a-development-branch/SKILL.md
git commit -m "$(cat <<'EOF'
feat(evolution): Add solidification to finishing-a-development-branch

Adds evolution integration at session end:
- Solidify session signals into gene candidates
- Validate candidates against tiered gates
- Promote passed candidates to registry
- Export to file system backup

Reports "Session contributed X new genes" on completion.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Test Evolution System

**Files:**
- No file changes, verification only

**Step 1: Verify Redis is running**

Run:
```bash
redis-cli ping
```

Expected output:
```
PONG
```

If not running:
```bash
redis-server --daemonize yes
```

**Step 2: Test signal emission**

Run:
```bash
node -e "
const signals = require('./.claude/skills/capability-evolver/scripts/signals');
signals.emit('pattern', { pattern: 'test-pattern', count: 1 }, 'test-session')
  .then(() => console.log('Signal emitted successfully'))
  .catch(console.error);
"
```

Expected output:
```
Signal emitted successfully
```

**Step 3: Verify signal in Redis**

Run:
```bash
redis-cli LRANGE "evolution:session:test-session:signals" 0 -1
```

Expected output (JSON with signal data):
```
"{\"ts\":\"2026-02-25T...\",\"type\":\"signal\",\"category\":\"pattern\",...}"
```

**Step 4: Test solidification**

Run:
```bash
node -e "
const solidify = require('./.claude/skills/capability-evolver/scripts/solidify');
solidify.solidify('test-session')
  .then(result => console.log(JSON.stringify(result, null, 2)))
  .catch(console.error);
"
```

Expected output (candidates array with pattern):
```json
{
  "success": true,
  "signalsAnalyzed": 1,
  "candidates": [...],
  "message": "Created X gene candidates from 1 signals"
}
```

**Step 5: Test gene promotion**

Run:
```bash
node -e "
const promote = require('./.claude/skills/capability-evolver/scripts/promote');
promote.promoteSessionCandidates('test-session')
  .then(result => console.log(JSON.stringify(result, null, 2)))
  .catch(console.error);
"
```

Expected output:
```json
{
  "success": true,
  "promoted": 1,
  "genes": [...],
  "message": "Promoted 1 genes to registry"
}
```

**Step 6: Verify gene in registry**

Run:
```bash
redis-cli ZRANGE "evolution:genes:registry" 0 -1 WITHSCORES
```

Expected output (gene ID with score):
```
gene-20260225-xxxx
0.xx
```

**Step 7: Test export**

Run:
```bash
node -e "
const exportModule = require('./.claude/skills/capability-evolver/scripts/export');
exportModule.exportAll()
  .then(result => console.log(JSON.stringify(result, null, 2)))
  .catch(console.error);
"
```

Expected output:
```json
{
  "success": true,
  "genes": { "exported": 1, "genes": [...] },
  "snapshot": { "path": "...", "genesExported": 1 }
}
```

**Step 8: Verify exported files**

Run:
```bash
ls ~/.claude/evolution/genes/_private/
ls ~/.claude/evolution/export/
```

Expected output:
```
gene-20260225-xxxx.md
snapshot-20260225.json
```

**Step 9: Cleanup test data**

Run:
```bash
redis-cli KEYS "evolution:*" | xargs redis-cli DEL
```

---

## Summary

### Files Created

| File | Purpose |
|------|---------|
| `~/.claude/evolution/config.yaml` | Local configuration |
| `~/.claude/evolution/genes/_private/` | Private genes directory |
| `~/.claude/evolution/genes/_publishable/` | Publishable genes directory |
| `~/.claude/evolution/export/` | Backup snapshots |
| `.claude/evolution/README.md` | Documentation |
| `.claude/evolution/GEP_PROTOCOL.md` | Protocol spec |
| `.claude/evolution/shared-genes/README.md` | Contribution guide |
| `.claude/references/evolution/gene-template.md` | Gene template |
| `.claude/references/evolution/capsule-template.md` | Capsule template |
| `.claude/skills/capability-evolver/SKILL.md` | Skill definition |
| `.claude/skills/capability-evolver/scripts/redis.js` | Redis client |
| `.claude/skills/capability-evolver/scripts/signals.js` | Signal emission |
| `.claude/skills/capability-evolver/scripts/solidify.js` | Pattern extraction |
| `.claude/skills/capability-evolver/scripts/validate.js` | Validation gates |
| `.claude/skills/capability-evolver/scripts/promote.js` | Registry management |
| `.claude/skills/capability-evolver/scripts/export.js` | File backup |

### Files Modified

| File | Change |
|------|--------|
| `package.json` | Added ioredis dependency |
| `.claude/skills/project-session/SKILL.md` | Added gene loading |
| `.claude/skills/finishing-a-development-branch/SKILL.md` | Added solidification |

### Commits

1. `chore: Add ioredis dependency for evolution system`
2. `feat(evolution): Add evolution system directory structure`
3. `feat(evolution): Add capability-evolver skill`
4. `feat(evolution): Add gene loading to project-session`
5. `feat(evolution): Add solidification to finishing-a-development-branch`

### What's NOT in Phase 1

- Task-level incremental learning (Phase 2)
- Project-level federation (Phase 3)
- Pruning/decay automation
- Cross-project promotion
- Signal emission from writing-plans, executing-plans
