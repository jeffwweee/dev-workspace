# Agent Notification Flow Analysis

**Date:** 2026-03-03
**Status:** Bug Analysis

## Complete Data Flow Architecture

### Message Inbound Flow (User → Agent)
```
┌─────────────────────────────────────────────────────────────────┐
│                        TELEGRAM                                  │
│  User sends message to bot                                        │
└────────────────────────┬────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                        GATEWAY (port 3100)                        │
│  1. Webhook receives message                                       │
│  2. XADD to tg:inbox (store message with bot_id field)            │
│  3. PUBLISH to tg:notify (notify orchestrator)                    │
└────────────────────────┬────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     ORCHESTRATOR (cc-orch)                        │
│  Redis SUBSCRIBE tg:notify (instant notification)                 │
│    ↓                                                              │
│  XREADGROUP tg:inbox (claim message by bot_id)                    │
│    ↓                                                              │
│  Route based on bot_id:                                           │
│    - 'pichu' → tmux inject /commander --message "..."             │
│    - 'pikachu' → tmux inject /telegram-agent --message "..."      │
│    - 'bulbasaur' → tmux inject /telegram-agent --message "..."    │
│    - 'charmander' → tmux inject /telegram-agent --message "..."   │
│    ↓                                                              │
│  XACK (acknowledge message)                                       │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                        AGENT (tmux session)                       │
│  Receives injected command                                        │
│  Processes message with skill (commander, handler, etc.)          │
└─────────────────────────────────────────────────────────────────┘
```

### Message Outbound Flow (Agent → User)
```
┌─────────────────────────────────────────────────────────────────┐
│                        AGENT (tmux session)                       │
│  Calls /telegram-reply "Response text"                            │
│    or /agent-notify complete TASK-XXX                              │
└────────────────────────┬────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                  TELEGRAM-REPLY SKILL (curl-based)                │
│  1. Retrieves context from Redis (tg:context:{chat}:{msg})       │
│  2. Formats text with template if specified                       │
│  3. curl POST to gateway /reply endpoint                          │
└────────────────────────┬────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   GATEWAY /reply ENDPOINT                         │
│  1. Validates message (bot_id, chat_id, text)                     │
│  2. Applies template if specified                                  │
│  3. Converts Markdown to Telegram MarkdownV2                      │
│  4. PUBLISH to tg:outbox (for logging)                            │
│  5. Sends to Telegram Bot API                                     │
└────────────────────────┬────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                        TELEGRAM                                  │
│  User receives message from bot                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Why Pub/Sub for Inbox?

| Approach | Latency | Complexity | Orchestrator Control |
|----------|---------|------------|---------------------|
| Polling (30s) | Up to 30s delay | Simple | Yes |
| **Pub/Sub** | **Instant** | Medium | **Yes** |

**Benefits of Pub/Sub:**
- Real-time message delivery (no 30s polling delay)
- Orchestrator still maintains routing logic
- Agents remain passive (no polling in tmux)
- Centralized control over message routing

---

## Problem Summary

### Expected Flow
```
Talk to Pichu → Pichu dispatches → Backend (Pikachu) reports via PIKACHU bot
→ Backend done → QA (Bulbasaur) reports via BULBASAUR bot
→ QA done → Git (Charmander) reports via CHARMANDER bot
```

### Actual Flow
```
Talk to Pichu → Pichu dispatches → Backend (Pikachu) SILENT
→ Task assigned to QA via PICHU (wrong!) → QA (Bulbasaur) SILENT
→ QA updates via PICHU (wrong!) → Charmander sends empty files message via PICHU
```

---

## Root Cause Analysis

### Issue 1: Orchestrator hijacks all notifications

**File:** `lib/orchestrator.ts`

The `sendNotification()` function ALWAYS sends via `pichu` bot:

```typescript
// Line 209-235
async function sendNotification(text: string): Promise<void> {
  const orchestratorBot = getBotByRole('orchestrator');  // ← ALWAYS pichu
  ...
  body: JSON.stringify({
    bot_id: 'pichu',  // ← HARDCODED
    chat_id: adminChat,
    text
  })
}
```

**Called from:**
| Function | Line | Message |
|----------|------|---------|
| `assignTask()` | 202 | `🔧 ${agent} assigned to ${task.id}` |
| `handleTaskComplete()` | 276 | `✅ ${originalTaskId} fully complete!` |
| `handleTaskComplete()` | 290 | `✅ ${taskId} complete!` |
| `handleTaskComplete()` | 327 | `📤 ${taskId}: ${agent} → ${nextAgent}` |
| `handleIssuesFound()` | 345 | `⚠️ ${taskId}: issues but no previous agent` |
| `handleIssuesFound()` | 373 | `🔄 ${taskId}: ${agent} → ${previousAgent}` |
| `handleTaskFailed()` | 388 | `❌ ${taskId} failed` |

**Problem:** Orchestrator is sending task transition notifications on behalf of agents instead of letting agents notify themselves.

---

### Issue 2: Agent environment missing identity

**File:** `lib/spawn-agent.ts`

Agents are spawned WITHOUT `AGENT_ROLE` or `AGENT_NAME` environment variables:

```typescript
// Line 126 - Only unsets CLAUDECODE, doesn't set AGENT_*
const startCmd = `env -u CLAUDECODE claude --dangerously-skip-permissions --model ${model} ${initialPrompt}`;
```

**Impact:** When `bin/agent-notify.ts` tries to detect agent role:

```typescript
// bin/agent-notify.ts line 58-79
function detectAgentRole(): string {
  if (process.env.AGENT_ROLE) return process.env.AGENT_ROLE;  // ← NOT SET
  const agentName = process.env.AGENT_NAME || process.env.CLAUDE_AGENT_NAME;  // ← NOT SET
  if (agentName) { ... }
  return 'orchestrator';  // ← DEFAULTS TO ORCHESTRATOR
}
```

**Result:** All `agent-notify` calls default to `orchestrator` role → pichu bot.

---

### Issue 3: Handler skills vs Orchestrator overlap

**Handler Skills** (backend-handler, qa-handler) instruct agents to call:
```bash
npx tsx bin/agent-notify.ts assignment TASK-XXX
npx tsx bin/agent-notify.ts complete TASK-XXX --details
```

**But:** Orchestrator ALSO sends its own notifications:
```typescript
// orchestrator.ts line 202
await sendNotification(`🔧 ${agent} assigned to ${task.id}`);
```

**Result:** Duplicate notifications, with orchestrator's winning (or confusing users).

---

### Issue 4: Pichu keeps polling instead of waiting

**Files:** `config/gateway.yaml`, `.claude/skills/commander/SKILL.md`

**Commander skill explicitly says (lines 56, 299, 302):**
> "DO NOT poll for messages - wait for orchestrator to provide them"
> "DO NOT loop/wait for agent completion - trust cc-orch"

**But `config/gateway.yaml` has:**
```yaml
bots:
  - name: "pichu"
    role: "orchestrator"
    wake_command: "/telegram-agent --poll --name pichu"  # ← WRONG! Should NOT poll
```

**ALL bots have `--poll` in their wake_command:**
```yaml
pichu:       wake_command: "/telegram-agent --poll --name pichu"      # ← REMOVE --poll
pikachu:     wake_command: "/telegram-agent --poll --name pikachu"    # ← OK (worker agent)
raichu:      wake_command: "/telegram-agent --poll --name raichu"     # ← OK (worker agent)
bulbasaur:   wake_command: "/telegram-agent --poll --name bulbasaur"  # ← OK (worker agent)
charmander:  wake_command: "/telegram-agent --poll --name charmander" # ← OK (worker agent)
```

**The problem:**
1. Pichu is started with `--poll` flag → continuously polls for messages
2. Commander skill says pichu should NOT poll → should wait for orchestrator to inject messages
3. This creates a loop where pichu keeps polling instead of being event-driven

**Correct architecture:**
```
┌─────────────────┐
│   Gateway       │ ← Receives webhooks from Telegram
│   (port 3100)   │ ← Stores in Redis inbox
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  cc-orch loop   │ ← Polls Redis inbox
│  (background)   │ ← Routes to appropriate agent via tmux inject
└────────┬────────┘
         │
         │ tmux inject: "/commander --message '...'"
         ▼
┌─────────────────┐
│     Pichu       │ ← Should NOT poll, just receive injected messages
│  (commander)    │ ← Processes and responds via /telegram-reply
└─────────────────┘
```

**Pichu should be event-driven, not polling.**

---

## Fix Plan

### Fix 1: Remove orchestrator task notifications (let agents notify)

**File:** `lib/orchestrator.ts`

Remove or modify these calls:
- [ ] Remove `sendNotification()` in `assignTask()` - agents should notify themselves
- [ ] Remove transition notifications in `handleTaskComplete()` - agents notify on completion
- [ ] Keep only system-level notifications (full completion, failures needing intervention)

### Fix 2: Add AGENT_ environment variables to spawn

**File:** `lib/spawn-agent.ts`

```typescript
// Add environment variables
const envVars = `AGENT_NAME=${name} AGENT_ROLE=${name}`;
const startCmd = `env -u CLAUDECODE ${envVars} claude --dangerously-skip-permissions --model ${model} ${initialPrompt}`;
```

### Fix 3: Agent-notify should use tmux session name as fallback

**File:** `bin/agent-notify.ts`

Add fallback to detect role from tmux session name:

```typescript
function detectAgentRole(): string {
  // ... existing env var checks ...

  // Fallback: Check tmux session name
  try {
    const sessionOutput = execSync('tmux display-message -p "#S"', { encoding: 'utf-8' });
    const sessionName = sessionOutput.trim();
    // cc-backend → backend, cc-qa → qa, etc.
    const roleMatch = sessionName.match(/^cc-(.+)$/);
    if (roleMatch) {
      return roleMatch[1];
    }
  } catch {}

  return 'orchestrator';
}
```

### Fix 4: Ensure agents call agent-notify on assignment

**File:** Handler skills (backend-handler, qa-handler, etc.)

Verify the workflow is followed:
1. Agent receives task injection
2. Agent immediately calls `npx tsx bin/agent-notify.ts assignment TASK-XXX`
3. Agent does work
4. Agent calls `npx tsx bin/agent-notify.ts complete TASK-XXX --details`

---

## Notification Ownership Matrix

| Event | Current (Wrong) | Should Be |
|-------|-----------------|-----------|
| Task assigned to backend | Pichu | **Pikachu** (via agent-notify) |
| Backend completed | Pichu | **Pikachu** (via agent-notify) |
| Task assigned to QA | Pichu | **Bulbasaur** (via agent-notify) |
| QA completed | Pichu | **Bulbasaur** (via agent-notify) |
| QA issues found | Pichu | **Bulbasaur** (via agent-notify) |
| Git decision needed | Charmander ✓ | Charmander ✓ |
| Task fully complete | Pichu | **Pichu** (system notification - OK) |
| Task failed | Pichu | **Pichu** (system notification - OK) |

---

## Summary of Changes

1. **`lib/spawn-agent.ts`**: Add `AGENT_NAME` and `AGENT_ROLE` env vars
2. **`bin/agent-notify.ts`**: Add tmux session name fallback for role detection
3. **`lib/orchestrator.ts`**: Remove task-level notifications, keep only system notifications
4. **Handler skills**: Verify agents call `agent-notify` at start and end of work
5. **`config/gateway.yaml`**: Remove `--poll` from pichu's wake_command (orchestrator should be event-driven, not polling)
6. **`lib/orchestrator.ts`**: Add message polling from Redis inbox and inject to pichu via tmux

---

## Fix #5: Remove polling from pichu

**File:** `config/gateway.yaml`

```yaml
# Before
- name: "pichu"
  wake_command: "/telegram-agent --poll --name pichu"

# After
- name: "pichu"
  wake_command: "/telegram-agent --name pichu --who 'orchestrator assistant'"
```

**File:** `lib/orchestrator.ts`

Add Telegram inbox polling to orchestrator loop:

```typescript
async function checkTelegramInbox(): Promise<void> {
  // Poll Redis inbox for new messages
  const message = await pollRedisInbox();

  if (message) {
    // Inject to pichu via tmux
    await injectTmuxCommand(
      { session: 'cc-orchestrator', window: 0, pane: 0 },
      `/commander --message '${JSON.stringify(message)}'`
    );
  }
}
```

This makes pichu event-driven instead of continuously polling.

---

## Fix #7: Implement Pub/Sub for Message Routing

**Status:** TODO

Replace polling with Redis pub/sub for instant message routing.

### Architecture Change

**Before (Polling):**
```
Orchestrator loop (every 30s)
    → XREADGROUP tg:inbox
    → Route to agent
```

**After (Pub/Sub):**
```
Orchestrator SUBSCRIBE tg:notify (instant)
    → XREADGROUP tg:inbox (claim by bot_id)
    → Route to agent via tmux inject
```

### Implementation

**File:** `lib/orchestrator.ts`

```typescript
// Create Redis subscriber for notifications
const subscriber = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Subscribe to notification channel
await subscriber.subscribe('tg:notify');

subscriber.on('message', async (channel, message) => {
  if (channel !== 'tg:notify') return;

  try {
    const notification = JSON.parse(message);
    const { botId, chatId, messageId } = notification;

    console.log(`[Orchestrator] Received notification for ${botId}`);

    // Claim the actual message from inbox using consumer group
    const messages = await redisClient.call(
      'XREADGROUP',
      'GROUP', 'orchestrator-consumer',
      'tg:inbox',
      'COUNT', '1',
      'STREAMS', 'tg:inbox',
      messageId  // Claim specific message
    );

    if (!messages) return;

    // Parse and route to correct agent
    // ... existing routing logic ...

  } catch (error) {
    console.error('[Orchestrator] Notification handling error:', error);
  }
});
```

**File:** `modules/bots/packages/gateway/src/routes/webhook.ts` (or equivalent)

```typescript
// After storing message in inbox, publish notification
await redis.xadd('tg:inbox', '*', {
  bot_id: botId,
  chat_id: chatId,
  text: messageText,
  user_id: userId,
  // ... other fields
});

// Publish notification for orchestrator
await redis.publish('tg:notify', JSON.stringify({
  botId,
  chatId,
  messageId: result.id,  // ID from XADD
  timestamp: Date.now()
}));
```

### Benefits

1. **Instant delivery** - No 30s polling delay
2. **Lower Redis load** - No continuous polling
3. **Better UX** - Agents respond immediately
4. **Scalable** - Multiple orchestrators can subscribe

### Routing Logic

| botId | Route To | tmux session | Inject Command |
|-------|----------|--------------|----------------|
| `pichu` | Orchestrator | `cc-orchestrator` | `/commander --message "..."` |
| `pikachu` | Backend | `cc-backend` | `/telegram-agent --message "..."` |
| `raichu` | Frontend | `cc-frontend` | `/telegram-agent --message "..."` |
| `bulbasaur` | QA | `cc-qa` | `/telegram-agent --message "..."` |
| `charmander` | Git | `cc-review-git` | `/telegram-agent --message "..."` |

### Tasks

- [ ] Update gateway to publish to `tg:notify` after XADD
- [ ] Update orchestrator to subscribe to `tg:notify`
- [ ] Remove polling loop for inbox, keep for task queues only
- [ ] Test message routing for all agents
- [ ] Update documentation

