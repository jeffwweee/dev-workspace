# Gateway-Orchestrator Integration Implementation Plan

> **Design:** docs/plans/2026-03-01-gateway-orchestrator-integration-design.md
> **For Claude:** REQUIRED SUB-SKILL: Use `plan-execute` or `plan-parallel` skill to implement this plan task-by-task.

**Goal:** Integrate Telegram gateway with multi-agent orchestrator so gateway routes all messages to pichu, and orchestrator loop handles task routing to agent tmux sessions.

**Architecture:** Gateway receives webhooks → writes to Redis → wakes pichu tmux. Orchestrator loop polls agent queues → injects tasks to agent tmux → monitors progress → sends notifications.

**Tech Stack:** TypeScript, Node.js, tmux, Redis, Express

---

## Task 1: Create Gateway Config

**Files:**
- Create: `config/gateway.yaml`

**Step 1: Create config file**

```yaml
# config/gateway.yaml
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

  - name: "raichu"
    username: "raichu_cc_bot"
    token: "${RAICHU_BOT_TOKEN}"
    webhook_path: "/webhook/raichu"
    role: "frontend"
    tmux:
      session: "cc-frontend"
      window: 0
      pane: 0
    wake_command: "/telegram-agent --poll"
    permissions:
      allowed_chats: [195061634]
      admin_users: [195061634]

  - name: "bulbasaur"
    username: "bulbasaur_cc_bot"
    token: "${BULBASAUR_BOT_TOKEN}"
    webhook_path: "/webhook/bulbasaur"
    role: "qa"
    tmux:
      session: "cc-qa"
      window: 0
      pane: 0
    wake_command: "/telegram-agent --poll"
    permissions:
      allowed_chats: [195061634]
      admin_users: [195061634]

  - name: "charmander"
    username: "charmander_cc_bot"
    token: "${CHARMANDER_BOT_TOKEN}"
    webhook_path: "/webhook/charmander"
    role: "review-git"
    tmux:
      session: "cc-review"
      window: 0
      pane: 0
    wake_command: "/telegram-agent --poll"
    permissions:
      allowed_chats: [195061634]
      admin_users: [195061634]

logging:
  level: "info"
  format: "pretty"
```

**Step 2: Commit**

```bash
git add config/gateway.yaml
git commit -m "feat: add gateway config with bot definitions

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Update Gateway Start Script

**Files:**
- Modify: `bin/telegram-gateway.ts:36-38`

**Step 1: Update default config path**

Change line 36-38 from:
```typescript
if (!configPath) {
  configPath = 'modules/bots/config/bots.local.yaml';
}
```

To:
```typescript
if (!configPath) {
  configPath = 'config/gateway.yaml';
}
```

**Step 2: Update error message**

Change lines 46-49 from:
```typescript
  console.error('\nAvailable configs:');
  console.error('  modules/bots/config/bots.local.yaml  - Local development');
  console.error('  modules/bots/config/bots.example.yaml - Example template');
```

To:
```typescript
  console.error('\nAvailable configs:');
  console.error('  config/gateway.yaml                   - Dev-workspace config');
  console.error('  modules/bots/config/bots.local.yaml  - Alternative (modules/bots)');
```

**Step 3: Commit**

```bash
git add bin/telegram-gateway.ts
git commit -m "feat: update gateway script to use config/gateway.yaml

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Create Shared tmux Module

**Files:**
- Create: `lib/tmux.ts`

**Step 1: Create tmux module**

```typescript
// lib/tmux.ts
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export interface TmuxTarget {
  session: string;
  window: number;
  pane: number;
}

/**
 * Format tmux target string
 */
export function formatTmuxTarget(target: TmuxTarget): string {
  return `${target.session}:${target.window}.${target.pane}`;
}

/**
 * Inject command into tmux session
 * @param target - Tmux target (session, window, pane)
 * @param command - Command to inject (will be followed by Enter)
 * @throws Error if tmux command fails
 */
export async function injectTmuxCommand(
  target: TmuxTarget,
  command: string
): Promise<void> {
  const targetStr = formatTmuxTarget(target);
  const escapedCommand = command.replace(/"/g, '\\"');

  try {
    // Send the command text first (without Enter)
    await execAsync(`tmux send-keys -t ${targetStr} "${escapedCommand}"`);

    // Delay before sending Enter to ensure command is registered
    await new Promise(resolve => setTimeout(resolve, 300));

    // Then send Enter
    await execAsync(`tmux send-keys -t ${targetStr} Enter`);

    console.log(`[Tmux] Injected command into ${targetStr}: ${command.substring(0, 50)}...`);
  } catch (error) {
    console.warn(`[Tmux] Failed to inject command into ${targetStr}:`, error);
    throw error;
  }
}

/**
 * Check if tmux session exists
 */
export async function sessionExists(sessionName: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync(`tmux list-sessions -F '#{session_name}'`);
    const sessions = stdout.trim().split('\n');
    return sessions.includes(sessionName);
  } catch {
    return false;
  }
}

/**
 * Synchronous version for use in spawn routines
 */
export function injectTmuxCommandSync(target: TmuxTarget, command: string): void {
  const { execSync } = require('child_process');
  const targetStr = formatTmuxTarget(target);
  const escapedCommand = command.replace(/"/g, '\\"');

  execSync(`tmux send-keys -t ${targetStr} "${escapedCommand}"`);
  execSync('sleep 0.3');
  execSync(`tmux send-keys -t ${targetStr} Enter`);
}
```

**Step 2: Commit**

```bash
git add lib/tmux.ts
git commit -m "feat: add shared tmux module for command injection

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Add Bot Identity Injection to spawn-agent

**Files:**
- Modify: `lib/spawn-agent.ts:71-86`

**Step 1: Add import for getBotByRole**

Add at line 4:
```typescript
import { getBotByRole } from './orchestration-config';
```

**Step 2: Add telegram-agent identity injection**

Replace lines 71-86 with:
```typescript
  // Wait for startup
  execSync('sleep 5');

  // Inject telegram-agent identity FIRST (before other skills)
  // This establishes the bot identity for /telegram-reply
  const botConfig = getBotByRole(name);
  if (botConfig) {
    const identityCmd = `/telegram-agent --name ${botConfig.name} --who "${persona || botConfig.role}"`;
    execSync(`tmux send-keys -t ${sessionName} '${identityCmd}' Enter`);
    execSync('sleep 2');
  }

  // Configure agent if persona provided (legacy agent-setup)
  if (persona) {
    let agentCmd = `/agent-setup --who "${persona}" --response-style ${style}`;
    if (memoryFile) {
      agentCmd += ` --memory ${memoryFile}`;
    }
    execSync(`tmux send-keys -t ${sessionName} '${agentCmd}' Enter`);
    execSync('sleep 2');
  }

  // Load skills
  for (const skill of skills) {
    execSync(`tmux send-keys -t ${sessionName} '/skill ${skill}' Enter`);
    execSync('sleep 1');
  }
```

**Step 3: Commit**

```bash
git add lib/spawn-agent.ts
git commit -m "feat: inject telegram-agent identity on agent spawn

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Implement Orchestrator Queue Watching

**Files:**
- Modify: `lib/orchestrator.ts:109-113`

**Step 1: Add imports**

Add at the top of file (around line 1-8):
```typescript
import { injectTmuxCommand, TmuxTarget } from './tmux';
import { getBotByRole } from './orchestration-config';
```

**Step 2: Implement checkEntryPoints**

Replace lines 109-113 with:
```typescript
/**
 * Checks entry points for new tasks
 */
async function checkEntryPoints(): Promise<void> {
  // Check each agent's queue for new tasks
  for (const agent of getCoreAgents()) {
    const queueLength = getQueueLength(agent);

    if (queueLength > 0) {
      // Check if agent is busy
      const busyWithTask = [...state.activeTasks.values()].find(t => t.agent === agent);

      if (!busyWithTask) {
        const task = dequeueTask(agent);

        if (task) {
          await assignTask(agent, task);
        }
      }
    }
  }
}
```

**Step 3: Implement assignTask**

Add after checkEntryPoints:
```typescript
/**
 * Assigns a task to an agent
 */
async function assignTask(agent: string, task: { id: string; planPath?: string; handoffPath?: string; workflow?: string }): Promise<void> {
  const sessionName = `cc-${agent}`;
  const config = loadConfig();
  const botConfig = getBotByRole(agent);

  console.log(`[Orchestrator] Assigning ${task.id} to ${agent}`);

  // Create progress file
  createProgressFile(agent, task.id, {
    description: task.planPath || task.handoffPath || `Task ${task.id}`
  });

  // Track as active
  state.activeTasks.set(task.id, {
    agent,
    status: 'IN_PROGRESS',
    started: new Date().toISOString(),
    workflow: task.workflow
  });

  // Build injection command
  let injectCmd = '';
  if (task.handoffPath) {
    injectCmd = `/plan-execute --handoff ${task.handoffPath}`;
  } else if (task.planPath) {
    injectCmd = `/plan-execute --plan ${task.planPath}`;
  } else {
    injectCmd = `/plan-execute --task ${task.id}`;
  }

  // Inject task to agent tmux
  try {
    await injectTmuxCommand(
      { session: sessionName, window: 0, pane: 0 },
      injectCmd
    );
  } catch (error) {
    console.error(`[Orchestrator] Failed to inject to ${sessionName}:`, error);
    return;
  }

  // Send notification via orchestrator bot (pichu)
  const orchestratorBot = getBotByRole('orchestrator');
  const adminChat = orchestratorBot?.permissions?.admin_users?.[0];

  if (adminChat) {
    await sendNotification(`🔧 ${agent} assigned to ${task.id}`);
  }
}

/**
 * Sends a notification via gateway /reply endpoint
 */
async function sendNotification(text: string): Promise<void> {
  const orchestratorBot = getBotByRole('orchestrator');
  const adminChat = orchestratorBot?.permissions?.admin_users?.[0];

  if (!adminChat) {
    console.warn('[Orchestrator] No admin chat configured for notifications');
    return;
  }

  try {
    const response = await fetch('http://localhost:3100/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bot_id: 'pichu',
        chat_id: adminChat,
        text
      })
    });

    if (!response.ok) {
      console.error('[Orchestrator] Failed to send notification:', await response.text());
    }
  } catch (error) {
    console.error('[Orchestrator] Notification error:', error);
  }
}
```

**Step 4: Commit**

```bash
git add lib/orchestrator.ts
git commit -m "feat: implement queue watching and task assignment in orchestrator

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 6: Add Stage Transition Notifications

**Files:**
- Modify: `lib/orchestrator.ts:142-180`

**Step 1: Update handleTaskComplete to send notifications**

Replace the handleTaskComplete function with:
```typescript
/**
 * Handles task completion
 */
async function handleTaskComplete(taskId: string, taskInfo: { agent: string; workflow?: string }): Promise<void> {
  console.log(`[Orchestrator] Task ${taskId} completed by ${taskInfo.agent}`);

  const workflow = getWorkflow(taskInfo.workflow || 'default');
  const currentIndex = workflow.pipeline.indexOf(taskInfo.agent);

  if (currentIndex === -1 || currentIndex === workflow.pipeline.length - 1) {
    // Task fully complete
    console.log(`[Orchestrator] Task ${taskId} fully complete!`);

    // Send completion notification
    await sendNotification(`✅ ${taskId} complete!`);

    state.activeTasks.delete(taskId);
    return;
  }

  const nextAgent = workflow.pipeline[currentIndex + 1];

  // Create handoff
  const handoff = createHandoff({
    from: taskInfo.agent,
    to: nextAgent,
    taskId,
    status: 'COMPLETE',
    confidence: 0.8,
    summary: `Completed by ${taskInfo.agent}`
  });

  const handoffPath = saveHandoff(handoff, taskId, taskInfo.agent, nextAgent);

  // Enqueue for next agent
  const enqueueResult = enqueueTask(nextAgent, {
    id: taskId,
    handoffPath
  });

  if (enqueueResult.success) {
    console.log(`[Orchestrator] Queued ${taskId} for ${nextAgent}`);

    // Send stage transition notification
    await sendNotification(`📤 ${taskId}: ${taskInfo.agent} → ${nextAgent}`);
  }

  state.activeTasks.delete(taskId);
}
```

**Step 2: Commit**

```bash
git add lib/orchestrator.ts
git commit -m "feat: add stage transition notifications

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 7: Verify Integration

**Files:**
- None (manual verification)

**Step 1: Build the gateway**

```bash
cd modules/bots/packages/gateway && npm run build
```

**Step 2: Start Redis**

```bash
redis-server
```

**Step 3: Start the gateway**

```bash
npx tsx bin/telegram-gateway.ts
```

**Step 4: Start orchestrator loop (separate terminal)**

```bash
npx tsx bin/cc-orch.ts start
```

**Step 5: Verify endpoints**

```bash
# Check gateway health
curl http://localhost:3100/health

# Check orchestrator status
npx tsx bin/cc-orch.ts status
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Create gateway config | `config/gateway.yaml` |
| 2 | Update gateway script | `bin/telegram-gateway.ts` |
| 3 | Create tmux module | `lib/tmux.ts` |
| 4 | Add bot identity injection | `lib/spawn-agent.ts` |
| 5 | Implement queue watching | `lib/orchestrator.ts` |
| 6 | Add notifications | `lib/orchestrator.ts` |
| 7 | Verify integration | Manual |
