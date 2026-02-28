# Dev-Workspace V4: Multi-Agent Orchestrator Design

> **For Claude:** REQUIRED SUB-SKILL: Use `writing-plans` skill to create implementation plan from this design.

**Goal:** Build a fully automated multi-agent orchestration system where a primary orchestrator coordinates multiple Claude Code agents across tmux sessions to execute complex workflows with Telegram integration.

**Architecture:** Primary orchestrator (Claude Code in tmux) manages core agents (backend, frontend, qa, review-git) and adhoc agents (spawned on demand). File-based state management with Redis evolution sync. Telegram for entry points and notifications.

**Tech Stack:** Node.js, tmux, Redis, existing Telegram gateway, file-based state, cron (future RSS)

---

## Overview

### Problem

Current dev-workspace requires manual coordination:
1. Single Claude Code session per task
2. No automated workflow pipeline (Database → Backend → Frontend → QA)
3. No parallel agent execution across projects
4. No automatic learning sharing between agents
5. Manual tmux session management

### Solution

1. **Primary Orchestrator** - Claude Code session running orchestration loop
2. **Core Agents** - Always-running specialists (backend, frontend, qa, review-git)
3. **Adhoc Agents** - Spawned on demand with task-specific configuration
4. **File-based State** - Memory files for persistence and handoffs
5. **Workflow Pipeline** - Automated stages with AI review gates
6. **Learning System** - Per-agent memory + sync to evolution registry

---

## Section 1: High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    DEV-WORKSPACE V4                             │
│                  "Multi-Agent Orchestrator"                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ENTRY POINTS                                                   │
│  ├── Telegram message → Primary Bot → Task Queue               │
│  └── Plan file created → Watcher detects → Task Queue          │
│                                                                 │
│  PRIMARY ORCHESTRATOR (Claude Code in tmux)                    │
│  ├── Runs orchestrator loop                                     │
│  ├── Routes tasks to agents                                    │
│  ├── Monitors agent progress files                             │
│  ├── Handles inter-agent communication                         │
│  └── Syncs learning across agents                              │
│                                                                 │
│  AGENT POOL                                                     │
│  ├── Core Agents (always running in tmux):                     │
│  │   ├── backend-agent (cc-backend window)                     │
│  │   ├── frontend-agent (cc-frontend window)                   │
│  │   ├── qa-agent (cc-qa window)                               │
│  │   └── review-git-agent (cc-review window)                   │
│  └── adhoc-agent (spawned on demand):                          │
│      ├── Single template, configured per-task                  │
│      ├── Persona + skills injected at spawn time               │
│      └── Terminated when work complete                         │
│                                                                 │
│  STATE MANAGEMENT                                               │
│  ├── PRIMARY_MEMORY.md (orchestrator state)                    │
│  ├── <AGENT>_MEMORY.md (per-agent learning)                    │
│  └── <AGENT>_<WORK>_PROGRESS.md (active task tracking)         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key Constraint:** All tmux spawning must use `env -u CLAUDECODE` to allow Claude Code to start in spawned sessions. See Section 6 for details.

---

## Section 2: Workflow Pipeline & Policies

### Pipeline Stages

```
Database → Backend → Review → Frontend → Review → QA → Deploy
   │          │         │          │         │        │
   ▼          ▼         ▼          ▼         ▼        ▼
db-agent  backend  review-git  frontend  review-git  qa   release
          -agent    -agent     -agent     -agent    -agent
```

### Review-git-agent Duties

The review-git-agent handles both code review AND git operations:

| Duty | Description |
|------|-------------|
| Code review | Quality check, best practices |
| Security scan | Vulnerability detection |
| Confidence score | 0-1 rating for auto-advance |
| Commit | Conventional commits format |
| Push | Push to feature branch |

### Review Gate Logic

```
┌─────────────────┐
│ review-git      │ ──► confidence score (0-1)
│ -agent          │ ──► commit hash (if passed)
└─────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ confidence >= threshold (e.g. 0.8)? │
└─────────────────────────────────────┘
         │
   ┌─────┴─────┐
   ▼           ▼
 YES          NO
   │           │
   ▼           ▼
Commit +    Block + notify
Push        via Telegram
Next stage  (retry/reassign/abort)
```

### Failure Handling

1. **Retry with exponential backoff** - Max 3 retries, base 30 seconds
2. **Escalate to human** - After retries exhausted, notify via Telegram
3. **Human options** - retry / reassign / abort

### Workflow Configuration

```yaml
workflows:
  default:
    pipeline: [backend, review-git, frontend, review-git, qa]
    review_threshold: 0.8
    max_retries: 3
    retry_backoff_base_ms: 30000

  backend_only:
    pipeline: [backend, review-git, qa]
    review_threshold: 0.85

  frontend_only:
    pipeline: [frontend, review-git, qa]
    review_threshold: 0.75

  full_stack:
    pipeline: [backend, review-git, frontend, review-git, qa]
    database_first: true
```

---

## Section 3: State Management, Queuing & Cleanup

### Memory Tiers

| Tier | Location | Purpose | Retention |
|------|----------|---------|-----------|
| Active | `state/` | Current work + recent history | Last 10-20 entries |
| Archived | `state/archive/YYYY-MM/` | Historical record | Indefinite |
| Consolidated | Redis evolution registry | Extracted patterns (genes) | Permanent |

### File Structure

```
state/
├── PRIMARY_MEMORY.md              # Orchestrator state
├── archive/
│   └── 2026-02/
│       ├── PRIMARY_2026-02-21.md
│       └── backend_MEMORY_2026-02-21.md
├── agents/
│   ├── backend_MEMORY.md
│   ├── frontend_MEMORY.md
│   ├── qa_MEMORY.md
│   ├── review-git_MEMORY.md
│   └── adhoc_MEMORY.md
├── work/
│   ├── backend_TASK-001_PROGRESS.md
│   └── frontend_TASK-001_PROGRESS.md
└── queues/
    ├── backend.queue.json
    ├── frontend.queue.json
    ├── qa.queue.json
    └── review-git.queue.json
```

### Archiving Triggers (Hybrid: Time + Size)

Archive when ANY of these conditions met:
- Weekly interval
- File exceeds 50KB
- Task count exceeds 50

### Archiving Process

1. Extract high-value learnings → Redis genes
2. Copy to `archive/YYYY-MM/` with timestamp
3. Truncate active memory to last N entries
4. Preserve "essential context" section

### Agent Assignment Logic

```
Task needs: frontend

1. Is frontend-agent IDLE?
   ├── YES → Assign immediately
   └── NO  → Continue

2. Is queue length < MAX_QUEUE (e.g. 3)?
   ├── YES → Add to queue, estimate wait time
   └── NO  → Continue

3. Can spawn adhoc? (within resource limits)
   ├── YES → Notify user, ask: Wait / Spawn adhoc?
   └── NO  → Force queue, notify user of delay
```

### Telegram Notification (when blocked)

```
⚠️ Agent Assignment Blocked

Task: TASK-015 (project-b)
Needs: frontend-agent
Status: OCCUPIED by project-a
Queue: 1 task ahead (~15 min wait)

Options:
[A] Wait in queue
[B] Spawn adhoc-frontend (uses extra resources)
```

### Resource Limits

```yaml
limits:
  max_adhoc_per_type: 2      # Max 2 adhoc frontend agents
  max_total_adhoc: 5         # Max 5 adhoc total
  max_queue_length: 3        # Force spawn if queue > 3
```

### Cleanup Strategy

| Agent Type | Cleanup Strategy |
|------------|------------------|
| Core agents | `/clear` + reload agent memory file |
| Adhoc agents | Idle timeout (30 min) → Kill tmux session |

Adhoc pool: Keep max 2 pre-warmed adhoc sessions ready.

---

## Section 4: Learning & Evolution System

### Dual Learning Approach

```
┌───────────────────────────────────────────────────────────┐
│ APPROACH 1: Per-Agent Learning (local)                    │
│                                                           │
│ Each agent maintains own memory file:                     │
│ ├── Learned patterns (what worked, what didn't)          │
│ ├── Project-specific conventions discovered              │
│ ├── Error resolutions that succeeded                     │
│ └── Confidence adjustments per task type                 │
│                                                           │
│ Updated at: Task completion, Error recovery              │
└───────────────────────────────────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────────────────────┐
│ APPROACH 2: Sync to Central Registry                     │
│                                                           │
│ Primary orchestrator periodically syncs:                  │
│ state/agents/*_MEMORY.md ──► Redis evolution registry    │
│                              (existing capability-evolver)│
│                                                           │
│ Sync triggers:                                            │
│ ├── Every N completed tasks                               │
│ ├── On explicit "learned something" signal                │
│ └── On session end (via finishing-a-development-branch)  │
└───────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────┐
│ APPROACH 3: Federated Learning via Handoffs              │
│                                                           │
│ Agents "teach" each other through handoff documents:     │
│                                                           │
│ backend → review-git handoff:                            │
│ ```                                                       │
│ ## Learnings for Reviewer                                │
│ - This project uses strict TypeScript, check types extra │
│ - Auth library is custom, not Passport                   │
│ ```                                                       │
│                                                           │
│ review-git incorporates into its next review             │
└───────────────────────────────────────────────────────────┘
```

### Evolution Flow

```
Task Complete ──► Signal emitted ──► Per-agent memory updated
       │                                              │
       │                                              ▼
       │                              Sync to Redis registry
       │                                              │
       ▼                                              ▼
Handoff doc ──► Next agent reads ──► Learns from peer
```

---

## Section 5: Primary Orchestrator Loop

### Orchestrator Lifecycle

```
         ┌──────────────┐
         │    START     │
         └──────┬───────┘
                │
                ▼
         ┌──────────────┐
         │  Load State  │ ← PRIMARY_MEMORY.md
         └──────┬───────┘
                │
                ▼
         ┌──────────────┐
         │ Check Entry  │ ← Telegram poll + plan file watch
         │   Points     │
         └──────┬───────┘
                │
                ▼
         ┌──────────────┐     ┌──────────────┐
         │  New Task?   │──NO──│   Monitor    │
         └──────┬───────┘     │   Agents     │
                │YES          │  Progress    │
                ▼              └──────┬───────┘
         ┌──────────────┐             │
         │Parse + Route │             │
         │  to Agent    │             │
         └──────┬───────┘             │
                │                     │
                ▼                     │
         ┌──────────────┐             │
         │Queue/Assign  │             │
         └──────┬───────┘             │
                │                     │
                └─────────────────────┘
                        │
                        ▼
               ┌──────────────┐
               │  Sync Loop   │ ← every 30 seconds
               │  (sleep)     │
               └──────────────┘
                        │
                        └─────────────► (back to top)
```

### Monitor Agents (each loop iteration)

For each active task:

1. Read `work/<agent>_<task>_PROGRESS.md`
2. Check status: `IN_PROGRESS | COMPLETE | BLOCKED | FAILED`
3. If COMPLETE → Trigger next pipeline stage
4. If BLOCKED/FAILED → Handle retry/escalation
5. Update `PRIMARY_MEMORY.md`

### Sync Learning (periodic, e.g. every 10 loops)

1. Read `agents/*_MEMORY.md`
2. Extract new learnings
3. Push to Redis evolution registry
4. Archive if thresholds met

---

## Section 6: CLAUDECODE Environment Variable Workaround

### Problem

When Claude Code spawns tmux sessions, the `CLAUDECODE=1` environment variable is inherited. Claude Code refuses to start inside these sessions with:

```
Error: Claude Code cannot be launched inside another Claude Code session.
```

Reference: https://github.com/anthropics/claude-agent-sdk-python/issues/573

### Solution

Unset CLAUDECODE when spawning tmux sessions for agents.

### Implementation

**Spawning core agent tmux session:**

```bash
# Wrong - inherits CLAUDECODE=1
tmux new-session -d -s cc-backend
tmux send-keys -t cc-backend "claude" Enter

# Correct - unset CLAUDECODE in the new session
tmux new-session -d -s cc-backend
tmux send-keys -t cc-backend "unset CLAUDECODE && claude" Enter
# OR use env -u
tmux send-keys -t cc-backend "env -u CLAUDECODE claude" Enter
```

**Spawning adhoc agent:**

```bash
spawn_adhoc_agent() {
  local agent_name=$1
  local persona=$2
  local skills=$3

  # Create tmux session with CLAUDECODE unset
  tmux new-session -d -s "cc-adhoc-${agent_name}"
  tmux send-keys -t "cc-adhoc-${agent_name}" \
    "env -u CLAUDECODE claude" Enter

  # Wait for Claude to start
  sleep 5

  # Inject persona and skills
  tmux send-keys -t "cc-adhoc-${agent_name}" \
    "/agent-setup --who \"${persona}\" --skills ${skills}" Enter
}
```

**Reference implementation (lib/spawn_agent.cjs):**

```javascript
const { execSync } = require('child_process');

function spawnAgent(options) {
  const {
    name,
    persona,
    skills = [],
    memoryFile,
    isAdhoc = false
  } = options;

  const sessionName = isAdhoc ? `cc-adhoc-${name}` : `cc-${name}`;

  // Create tmux session
  execSync(`tmux new-session -d -s ${sessionName} 2>/dev/null || true`);

  // Start Claude with CLAUDECODE unset
  const startCmd = 'env -u CLAUDECODE claude';
  execSync(`tmux send-keys -t ${sessionName} '${startCmd}' Enter`);

  // Wait for startup
  execSync('sleep 5');

  // Configure agent
  if (persona) {
    const agentCmd = `/agent-setup --who "${persona}" --memory ${memoryFile}`;
    execSync(`tmux send-keys -t ${sessionName} '${agentCmd}' Enter`);
  }

  return { sessionName, status: 'spawned' };
}

module.exports = { spawnAgent };
```

---

## Section 7: Configuration Files

### Extended bots.yaml

Preserve existing structure, add new fields for orchestration:

```yaml
bots:
  # PRIMARY ORCHESTRATOR
  - name: "pichu"
    username: "pichu_cc_bot"
    token: "..."
    tmux:
      session: "cc-orchestrator"
      window: 0
      pane: 0
    wake_command: "/orchestrator-agent --loop"
    role: "primary_orchestrator"       # NEW
    permissions:
      allowed_chats: [195061634]
      admin_users: [195061634]

  # CORE AGENTS
  - name: "backend-bot"
    username: "backend_cc_bot"
    token: "..."
    tmux:
      session: "cc-backend"
      window: 0
      pane: 0
    wake_command: "/telegram-agent --poll"
    role: "backend_agent"              # NEW
    agent_config:                      # NEW
      skills: [backend-patterns, python-patterns]
      memory_file: state/agents/backend_MEMORY.md
    permissions:
      allowed_chats: [195061634]
      admin_users: [195061634]

  - name: "frontend-bot"
    username: "frontend_cc_bot"
    token: "..."
    tmux:
      session: "cc-frontend"
    role: "frontend_agent"
    agent_config:
      skills: [frontend-patterns, ui-ux-pro-max]
      memory_file: state/agents/frontend_MEMORY.md

  - name: "qa-bot"
    username: "qa_cc_bot"
    token: "..."
    tmux:
      session: "cc-qa"
    role: "qa_agent"
    agent_config:
      skills: [tdd-workflow, e2e-testing]
      memory_file: state/agents/qa_MEMORY.md

  - name: "review-bot"
    username: "review_cc_bot"
    token: "..."
    tmux:
      session: "cc-review"
    role: "review_git_agent"
    agent_config:
      skills: [code-review, git-workflow, security-review]
      memory_file: state/agents/review-git_MEMORY.md
      outputs: [confidence_score, commit_hash]

  # ADHOC TEMPLATE (no dedicated bot, spawned dynamically)
  # Uses primary orchestrator's bot for notifications
```

### Role Types

| Role | Description |
|------|-------------|
| `primary_orchestrator` | Main coordinator, loop running |
| `backend_agent` | Backend/API development |
| `frontend_agent` | Frontend/UI development |
| `qa_agent` | Testing and verification |
| `review_git_agent` | Code review + git operations |
| `adhoc_agent` | Spawned dynamically, no dedicated bot |

### orchestration.yml

```yaml
orchestration:
  loop_interval_ms: 30000
  telegram_poll_interval_ms: 5000
  plan_watch_enabled: true
  plan_watch_paths:
    - "docs/plans/*.md"
    - "registry/tasks/*.md"

limits:
  max_adhoc_per_type: 2
  max_total_adhoc: 5
  max_queue_length: 3

cleanup:
  adhoc_idle_timeout_ms: 1800000    # 30 minutes
  core_agent_clear_on_complete: true

archiving:
  max_file_size_kb: 50
  max_task_count: 50
  weekly_archive: true

workflows:
  default:
    pipeline: [backend, review-git, frontend, review-git, qa]
    review_threshold: 0.8
    max_retries: 3
    retry_backoff_base_ms: 30000

  backend_only:
    pipeline: [backend, review-git, qa]
    review_threshold: 0.85

  frontend_only:
    pipeline: [frontend, review-git, qa]
    review_threshold: 0.75
```

---

## Section 8: Handoff Document Format

```markdown
# HANDOFF: backend → review-git

## Task: TASK-001
## Status: COMPLETE | BLOCKED | FAILED
## Confidence: 0.85

## Summary
- Implemented user authentication API
- Added JWT token validation

## Files Changed
- src/api/auth.ts (created)
- src/middleware/jwt.ts (modified)

## Learnings for Next Agent
- This project uses strict TypeScript
- Custom auth library, not Passport
- Check SQL injection protection carefully

## Blockers (if any)
- None

## Recommendations for Next Agent
- Review JWT expiry logic
- Check rate limiting implementation
```

---

## Section 9: Future - RSS/Cron Integration

### Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  System Cron │────►│  RSS Poller  │────►│  Queue File  │
│  (timer)     │     │  (script)    │     │  (state/rss) │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
                                                  ▼
                                         ┌──────────────┐
                                         │  Primary     │
                                         │  Orchestrator│
                                         │  (checks     │
                                         │  queue each  │
                                         │  loop)       │
                                         └──────────────┘
```

### File Structure

```
config/
└── rss.feeds.yml           # RSS feed definitions

state/
└── rss/
    ├── queue.json            # Pending RSS items to process
    └── processed.json        # Already processed item IDs
```

### rss.feeds.yml

```yaml
feeds:
  - name: "tech-news"
    url: "https://example.com/rss/tech.xml"
    poll_interval: "*/30 * * * *"   # Every 30 minutes
    processor: "summarize"          # How to handle
    notify_on_match:
      keywords: ["AI", "Claude", "LLM"]

  - name: "github-releases"
    url: "https://github.com/anthropics/claude-code/releases.atom"
    poll_interval: "0 */2 * * *"      # Every 2 hours
    processor: "changelog"
```

### Crontab Entry

```
# RSS feed polling
*/30 * * * * /path/to/dev-workspace/scripts/rss-poll.cjs
```

### Orchestrator Integration

In primary orchestrator loop:

```javascript
async function checkRssQueue() {
  const queueFile = 'state/rss/queue.json';
  const queue = JSON.parse(fs.readFileSync(queueFile));

  if (queue.length > 0) {
    const item = queue.shift();  // Take first item

    // Create task from RSS item
    const task = {
      id: `RSS-${Date.now()}`,
      type: item.processor,  // "summarize" or "changelog"
      source: item.feed_name,
      content: item.content,
      url: item.link
    };

    // Route to appropriate agent
    await routeTask(task);

    // Save updated queue
    fs.writeFileSync(queueFile, JSON.stringify(queue));

    // Mark as processed
    addToProcessed(item.id);
  }
}
```

---

## Dependencies

| Dependency | Purpose |
|------------|---------|
| tmux | Session management, agent isolation |
| Redis | Evolution registry, message queuing |
| Telegram gateway | Bot communication (existing) |
| bots.yaml | Bot configuration (extended) |
| Node.js | Scripts and utilities |

---

## Implementation Phases

### Phase 1: Foundation
- Extended bots.yaml schema
- orchestration.yml config
- State directory structure
- CLAUDECODE workaround implementation

### Phase 2: Core Agents
- Spawn/manage core agent tmux sessions
- Agent memory files
- Handoff document format
- Primary orchestrator loop

### Phase 3: Workflow Pipeline
- Pipeline stage routing
- Review-git agent integration
- Confidence threshold logic
- Telegram notifications

### Phase 4: Queuing & Learning
- Agent queues
- Adhoc spawning
- Learning sync to Redis
- Archive system

### Phase 5: RSS Integration (Future)
- RSS poller script
- Cron configuration
- Queue integration

---

## Testing Strategy

1. **Unit tests** - Spawn agent, CLAUDECODE workaround, queue logic
2. **Integration tests** - Full pipeline with simple plan
3. **Manual tests** - Telegram notifications, agent handoffs
4. **Load tests** - Multiple projects, queue contention
