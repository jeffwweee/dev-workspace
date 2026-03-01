# Gateway-Orchestrator Integration Design

**Date:** 2026-03-01
**Status:** Approved

---

## Overview

Design for integrating the Telegram gateway with the multi-agent orchestrator. The gateway handles Telegram webhooks, while the orchestrator loop manages task routing to agent tmux sessions.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  USER: "/plan-create - debug auth flow"                             │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  GATEWAY                                                            │
│  1. Write to Redis inbox                                            │
│  2. Inject wake command to pichu's tmux (cc-orchestrator)           │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PICHU (Claude Code in cc-orchestrator tmux)                        │
│  1. Receives message via /telegram-agent --poll                     │
│  2. Plans task, creates docs/plans/TASK-001.md                      │
│  3. Writes task to agent queue (state/pending/{agent}.json)         │
│  4. Responds: "Created plan TASK-001, routing to backend agent"     │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  ORCHESTRATOR LOOP (cc-orch.ts)                                     │
│  1. Detects new task in agent queue                                 │
│  2. Injects: tmux send-keys -t cc-backend "/plan-execute ..."       │
│  3. Sends notification: "🔧 backend assigned to TASK-001"           │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  BACKEND AGENT (Claude Code in cc-backend tmux)                     │
│  1. Receives task via /plan-execute                                 │
│  2. Sends notification: "🔧 Working on TASK-001..."                 │
│  3. Executes the plan                                               │
│  4. On completion: writes to state/progress/backend/TASK-001.md     │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  ORCHESTRATOR LOOP                                                  │
│  1. Detects TASK-001 complete                                       │
│  2. Routes to next stage: review-git                                │
│  3. Sends notification: "📤 TASK-001: backend → review-git"         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Component Responsibilities

| Component | Responsibilities |
|-----------|-----------------|
| **Gateway** | Receive webhooks → Write to Redis inbox → Wake pichu tmux |
| **Pichu** | Receive all Telegram messages → Plan tasks → Write to agent queues → Respond to user |
| **Orchestrator Loop** | Poll agent queues → Inject tasks to agent tmux → Monitor progress → Advance pipeline → Send stage transition notifications |
| **Agents** | Receive task → Send assignment notification → Execute → Write progress → Send completion notification |

---

## Data Flow & Message Formats

### Redis Keys

```
tg:inbox              # Incoming Telegram messages (stream)
tg:outbox             # Outgoing messages to Telegram (pub/sub)
task:queue:{agent}    # Task queues per agent (e.g., task:queue:backend)
task:progress:{agent}:{taskId}  # Progress tracking
```

### Task Queue Entry

```json
// state/pending/backend.json or Redis task:queue:backend
{
  "id": "TASK-001",
  "planPath": "docs/plans/2026-03-01-debug-auth.md",
  "workflow": "default",
  "submittedBy": "pichu",
  "submittedAt": "2026-03-01T10:30:00Z"
}
```

### Orchestrator → Agent Injection

```bash
tmux send-keys -t cc-backend "/plan-execute --plan docs/plans/2026-03-01-debug-auth.md" Enter
```

### Notifications

```bash
# Agent uses telegram-reply directly
/telegram-reply "🔧 Backend assigned to TASK-001: debug auth flow"

# Orchestrator sends via HTTP POST
POST /reply { "bot_id": "pichu", "chat_id": 195061634, "text": "📤 TASK-001: backend → review-git" }
```

---

## Orchestrator Loop Logic

### Main Loop

```typescript
async function runLoop() {
  while (running) {
    // 1. Check agent queues for new tasks
    for (const agent of CORE_AGENTS) {
      const task = dequeueTask(agent);
      if (task && !isAgentBusy(agent)) {
        await assignTask(agent, task);
      }
    }

    // 2. Monitor active tasks for completion
    for (const [taskId, taskInfo] of activeTasks) {
      const progress = readProgressFile(taskInfo.agent, taskId);

      if (progress.status === 'COMPLETE') {
        await advanceToNextStage(taskId, taskInfo);
      } else if (progress.status === 'BLOCKED') {
        await notifyBlocked(taskId, taskInfo);
      }
    }

    // 3. Cleanup idle adhoc agents
    cleanupIdleAdhocAgents();

    await sleep(LOOP_INTERVAL_MS);
  }
}
```

### Task Assignment

```typescript
async function assignTask(agent: string, task: Task): Promise<void> {
  const sessionName = `cc-${agent}`;

  // 1. Inject task to agent tmux
  await injectTmuxCommand(
    { session: sessionName, window: 0, pane: 0 },
    `/plan-execute --plan ${task.planPath}`
  );

  // 2. Track as active
  activeTasks.set(task.id, { agent, status: 'IN_PROGRESS', ... });

  // 3. Orchestrator sends notification
  await sendNotification(`🔧 ${agent} assigned to ${task.id}`);
}
```

### Stage Transition

```typescript
async function advanceToNextStage(taskId: string, taskInfo: TaskInfo) {
  const nextAgent = getNextAgentInPipeline(taskInfo.agent, taskInfo.workflow);

  if (nextAgent) {
    // 1. Create handoff
    const handoff = createHandoff(taskId, taskInfo.agent, nextAgent);

    // 2. Enqueue for next agent
    enqueueTask(nextAgent, { id: taskId, handoffPath: handoff.path });

    // 3. Send transition notification
    await sendNotification(`📤 ${taskId}: ${taskInfo.agent} → ${nextAgent}`);
  } else {
    // Task complete
    await sendNotification(`✅ ${taskId} complete!`);
    activeTasks.delete(taskId);
  }
}
```

---

## Agent Spawning with Bot Identity

When orchestrator spawns an agent, it injects `/telegram-agent` to establish bot identity:

```typescript
export function spawnAgent(options: SpawnOptions): SpawnResult {
  // ... create tmux session, start Claude ...

  // Load bot config for this agent
  const botConfig = getBotByRole(options.name);  // e.g., "backend" → pikachu

  // Inject telegram-agent identity
  if (botConfig) {
    const identityCmd = `/telegram-agent --name ${botConfig.name} --who "${options.persona || botConfig.role}"`;
    execSync(`tmux send-keys -t ${sessionName} '${identityCmd}' Enter`);
    execSync('sleep 2');
  }

  // ... load other skills ...
}
```

---

## Bot → Agent Mapping

| Agent Role | Bot Name | Telegram Username | Tmux Session |
|------------|----------|-------------------|--------------|
| orchestrator | pichu | pichu_cc_bot | cc-orchestrator |
| backend | pikachu | pikachu_cc_bot | cc-backend |
| frontend | raichu | raichu_cc_bot | cc-frontend |
| qa | bulbasaur | bulbasaur_cc_bot | cc-qa |
| review-git | charmander | charmander_cc_bot | cc-review |

---

## Files to Change

| File | Change |
|------|--------|
| `config/gateway.yaml` | **New** - gateway config in dev-workspace root |
| `bin/telegram-gateway.ts` | Update to point to `config/gateway.yaml` |
| `lib/spawn-agent.ts` | Add `/telegram-agent` identity injection on spawn |
| `lib/orchestrator.ts` | Implement queue watching, task assignment, notifications |
| `lib/tmux.ts` | **New** - shared tmux injection |
| `lib/orchestration-config.ts` | Add `getBotByRole()` helper |

---

## Config Structure

**Location:** `config/gateway.yaml`

```yaml
gateway:
  port: 3100
  host: "0.0.0.0"
  redis:
    url: "redis://localhost:6379"
    inbox_stream: "tg:inbox"
    outbox_channel: "tg:outbox"
  message:
    claim_timeout_ms: 30000
    max_retries: 3
    retry_delay_ms: 1000

bots:
  - name: "pichu"
    username: "pichu_cc_bot"
    token: "${PICHU_BOT_TOKEN}"
    webhook_path: "/webhook/pichu"
    role: "orchestrator"
    tmux:
      session: "cc-orchestrator"
      window: 0
      pane: 0
    wake_command: "/telegram-agent --poll"
    permissions:
      allowed_chats: [195061634]
      admin_users: [195061634]

  - name: "pikachu"
    username: "pikachu_cc_bot"
    token: "${PIKACHU_BOT_TOKEN}"
    webhook_path: "/webhook/pikachu"
    role: "backend"
    tmux:
      session: "cc-backend"
      window: 0
      pane: 0
    wake_command: "/telegram-agent --poll"
    permissions:
      allowed_chats: [195061634]
      admin_users: [195061634]

  # ... other bots (raichu, bulbasaur, charmander)
```

---

## Key Decisions

1. **Gateway routes to pichu only** - Gateway always wakes cc-orchestrator, pichu handles all user interaction
2. **Orchestrator loop routes to agents** - cc-orch.ts handles task assignment and pipeline progression
3. **Both send notifications** - Orchestrator notifies on stage transitions, agents notify on task events
4. **Agents know bot identity** - `/telegram-agent` injected on spawn, agents can use `/telegram-reply`
5. **Direct skill invocation** - Use `/plan-execute` not `/skill plan-execute`
