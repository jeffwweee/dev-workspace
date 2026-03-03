# Multi-Agent Telegram System Retrospective

**Date:** 2026-03-03
**Purpose:** Document learnings, troubles, and architecture decisions for fresh start

---

## Executive Summary

After ~3 weeks of development, the multi-agent Telegram orchestrator system has grown complex with overlapping responsibilities, duplicated code, and unclear message flow. This document captures all learnings to inform a clean rebuild.

---

## Architecture Overview

### Current Components

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           TELEGRAM                                       │
│  Users interact with bots (pichu, pikachu, raichu, bulbasaur, charmander)│
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        GATEWAY (port 3100)                               │
│  packages/gateway/                                                       │
│  - Receives webhooks from Telegram                                       │
│  - Stores messages in Redis streams (tg:inbox:{botId})                   │
│  - Publishes notifications to tg:notify channel                          │
│  - Handles /reply, /poll, /ack endpoints                                 │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼ (Redis pub/sub)
┌─────────────────────────────────────────────────────────────────────────┐
│                     ORCHESTRATOR (lib/orchestrator.ts)                   │
│  - Subscribes to tg:notify for instant routing                           │
│  - Routes messages to agent tmux sessions                                │
│  - Manages task queues (state/pending/)                                  │
│  - Monitors progress files (state/progress/)                             │
│  - Handles agent handoffs                                                │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼ (tmux send-keys)
┌─────────────────────────────────────────────────────────────────────────┐
│                     AGENT TMUX SESSIONS                                  │
│  cc-orchestrator (pichu)   → /commander skill                           │
│  cc-backend (pikachu)      → /backend-handler skill                     │
│  cc-frontend (raichu)      → /frontend-handler skill                    │
│  cc-qa (bulbasaur)         → /qa-handler skill                          │
│  cc-review-git (charmander)→ /review-git-handler skill                  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Bots Configuration

| Bot | Role | TMux Session | Telegram Token | Purpose |
|-----|------|--------------|----------------|---------|
| **pichu** | orchestrator | cc-orchestrator | Separate | Main user interface, task dispatch |
| **pikachu** | backend | cc-backend | Separate | Backend implementation |
| **raichu** | frontend | cc-frontend | Separate | Frontend implementation |
| **bulbasaur** | qa | cc-qa | Separate | QA testing & verification |
| **charmander** | review-git | cc-review-git | Separate | Code review & git operations |

---

## Troubles Encountered

### 1. Message Routing Confusion

**Problem:** Multiple ways to route messages, unclear which is correct.

**Current implementations:**
- Gateway `/poll` endpoint (HTTP polling)
- Orchestrator `checkTelegramInbox()` (polling)
- Orchestrator `routeMessageToAgent()` (pub/sub)
- Direct tmux injection from gateway (removed)

**Impact:** Messages sometimes processed twice, sometimes not at all.

### 2. Skill Invocation Duplication

**Problem:** Same skill invoked multiple ways:
```bash
/commander           # At bot init
/commander --message "text"  # On new message (WRONG - already loaded)
/backend-handler     # At bot init
/backend-handler --message "text"  # On new message (WRONG)
```

**Root cause:** Skills are loaded at session start but code tries to re-invoke them with `--message`.

### 3. Context Storage Fragmentation

**Problem:** Context stored in multiple formats:
- `tg:context:{chatId}:{messageId}` (orchestrator)
- `tg:inbox:context:{sessionId}` (gateway poll)
- In-memory `messageContexts` Map (gateway)

**Impact:** telegram-reply skill can't reliably find context.

### 4. Notification Identity Crisis

**Problem:** All notifications went through pichu instead of respective bot identities.

**Root causes:**
- `agent-notify.ts` couldn't detect agent role
- `AGENT_NAME` / `AGENT_ROLE` env vars not set
- Orchestrator hijacked all notifications

**Partial fix:** Added env vars to spawn-agent.ts, tmux session fallback.

### 5. Polling vs Event-Driven

**Problem:** Mixed polling and event-driven patterns.

| Component | Current | Issue |
|-----------|---------|-------|
| Gateway | Push (webhook) | OK |
| Orchestrator | Pub/sub + polling | Complex |
| Agent skills | Polling (--poll flag) | Conflicts with event-driven |

**Commander skill says:** "DO NOT poll - wait for orchestrator"
**Config says:** `wake_command: "/telegram-agent --poll --name pichu"`

### 6. Overlapping Responsibilities

**Gateway handles:**
- Webhook receiving
- Message storage
- Reply sending
- Polling for messages
- Context storage

**Orchestrator handles:**
- Message routing
- Task queues
- Progress monitoring
- Agent handoffs
- Telegram inbox polling
- Notification sending

**Skills handle:**
- Message processing
- Reply sending (via gateway)
- Context retrieval

**Result:** Too many places for things to go wrong.

### 7. Redis Key Inconsistency

**Keys used:**
```
tg:inbox                 # Single stream (old)
tg:inbox:{botId}         # Bot-specific streams (new)
tg:inbox:context:{botId} # Context storage
tg:context:{chatId}:{msgId} # Context storage (different format)
tg:outbox                # Outgoing messages
tg:notify                # Pub/sub notifications
tg:processed_updates     # Deduplication set
```

---

## What Works

### 1. Gateway Webhook
- Receives Telegram webhooks reliably
- Deduplication via Redis set
- Bot-specific stream storage

### 2. Agent Spawning
- `spawnAgent()` creates tmux sessions
- Persona injection via `/telegram-agent --who "..."`
- Model selection (sonnet/opus/haiku)

### 3. Task Queues
- File-based queues in `state/pending/`
- Priority support
- Handoff document format

### 4. Progress Tracking
- Progress files in `state/progress/`
- Status constants (IN_PROGRESS, COMPLETE, ISSUES_FOUND, etc.)
- Multiline field parsing

### 5. Telegram Bot API Integration
- MarkdownV2 conversion
- Message sending via gateway `/reply`
- Template support (ack, done, clarify, error)

---

## Architecture Decisions (Pros & Cons)

### tmux for Agent Sessions

| Pros | Cons |
|------|------|
| Persistent sessions | Requires tmux knowledge |
| Easy debugging (attach) | Complex injection |
| No state loss on crash | Hard to monitor |
| Works with Claude CLI | Race conditions on injection |

### Redis Streams for Messages

| Pros | Cons |
|------|------|
| Consumer groups for reliability | Complex XREADGROUP syntax |
| Message persistence | Multiple key formats confusing |
| Deduplication support | Context storage fragmented |

### File-Based Task Queues

| Pros | Cons |
|------|------|
| Human readable | No transactional safety |
| Easy debugging | Manual cleanup needed |
| Git-trackable | Race conditions possible |

### Skill-Based Agent Roles

| Pros | Cons |
|------|------|
| Modular | Skill loading confusion |
| Composable | Context passing complex |
| Reusable | Too many similar skills |

---

## Key Files Reference

### Gateway (modules/bots/packages/gateway/)
```
src/
├── routes/
│   └── webhook.ts        # Webhook handler, /reply, /poll, /ack
├── services/
│   ├── inbox.ts          # Redis stream operations
│   ├── router.ts         # Bot config lookup
│   ├── markdown.ts       # MarkdownV2 conversion
│   └── errors.ts         # Error aggregation
└── metrics/
    └── index.ts          # Prometheus metrics
```

### Orchestrator (lib/)
```
lib/
├── orchestrator.ts       # Main orchestrator loop, hooks
├── spawn-agent.ts        # Agent session management
├── queue-manager.ts      # Task queue operations
├── memory-manager.ts     # State file operations
├── handoff.ts            # Agent handoff documents
├── tmux.ts               # tmux injection wrapper
├── orchestration-config.ts # Bot config loading
└── status-constants.ts   # Status enums
```

### Skills (.claude/skills/)
```
skills/
├── commander/            # Pichu orchestrator skill
├── backend-handler/      # Pikachu task handler
├── frontend-handler/     # Raichu task handler
├── qa-handler/           # Bulbasaur task handler
├── review-git-handler/   # Charmander task handler
├── telegram-reply/       # Reply via gateway
├── telegram-agent/       # Identity + polling
├── agent-notify/         # Notifications via assigned bot
└── task-complete/        # Progress status update
```

### State Files (state/)
```
state/
├── primary.md            # Orchestrator memory
├── pending/              # Task queues ({role}-TASK-XXX.md)
├── progress/             # Progress files (TASK-XXX.md)
├── memory/               # Agent memory files
└── sessions/             # Chat session context
```

---

## Recommendations for Fresh Start

### 1. Simplify Message Flow
```
Telegram → Gateway → Redis Stream → Agent (direct read)
         ↓
         Redis Pub/Sub (notification only, no routing)
```

### 2. Unified Context Format
```typescript
interface MessageContext {
  botId: string;
  chatId: number;
  messageId: string;
  userId: number;
  text: string;
  username?: string;
  chatType: 'private' | 'group' | 'supergroup';
  replyTo?: number;
  timestamp: number;
}

// Single key format
const key = `tg:msg:${botId}:${messageId}`;
```

### 3. Agent Message Delivery
- Don't re-invoke skills with `--message`
- Inject raw message text to tmux
- Agent's loaded skill processes it

### 4. Remove Redundancy
- Remove orchestrator message routing (gateway handles)
- Remove `/poll` endpoint (agents are event-driven)
- Consolidate context storage to one format

### 5. Clear Ownership
```
Gateway:     Webhook → Redis storage → Notification
Agent:       Read Redis → Process → Reply via gateway
Orchestrator: Task queues + Progress monitoring ONLY
```

---

## Bot Identity Mapping

```yaml
# config/orchestration.yml
bots:
  - name: pichu
    role: orchestrator
    token_env: TELEGRAM_BOT_TOKEN_PICHU
    permissions:
      admin_users: [195061634]
    agent_config:
      persona: "orchestrator assistant"
      role_skill: orchestrator-developer

  - name: pikachu
    role: backend
    token_env: TELEGRAM_BOT_TOKEN_PIKACHU
    agent_config:
      persona: "senior backend developer"
      role_skill: backend-developer

  - name: raichu
    role: frontend
    token_env: TELEGRAM_BOT_TOKEN_RAICHU
    agent_config:
      persona: "senior frontend developer"
      role_skill: frontend-developer

  - name: bulbasaur
    role: qa
    token_env: TELEGRAM_BOT_TOKEN_BULBASAUR
    agent_config:
      persona: "QA engineer"
      role_skill: qa-developer

  - name: charmander
    role: review-git
    token_env: TELEGRAM_BOT_TOKEN_CHARMANDER
    agent_config:
      persona: "code reviewer and git specialist"
      role_skill: review-git-developer
```

---

## Session Names

| Agent | TMux Session | Redis Consumer Group |
|-------|--------------|---------------------|
| pichu | cc-orchestrator | tg-sessions:pichu |
| pikachu | cc-backend | tg-sessions:pikachu |
| raichu | cc-frontend | tg-sessions:raichu |
| bulbasaur | cc-qa | tg-sessions:bulbasaur |
| charmander | cc-review-git | tg-sessions:charmander |

---

## Lessons Learned

1. **Start simple, add complexity later** - The system grew too complex too fast
2. **One way to do things** - Multiple paths create confusion
3. **Clear ownership boundaries** - Gateway vs Orchestrator vs Skills
4. **Test incrementally** - Big changes broke things unexpectedly
5. **Document decisions** - Why was X done this way?
6. **Avoid skill re-invocation** - Skills loaded once, process multiple messages

---

## Files to Preserve

### Must Keep
- `modules/bots/packages/gateway/` (with cleanup)
- `lib/spawn-agent.ts` (agent management)
- `lib/tmux.ts` (tmux wrapper)
- `.claude/skills/*/SKILL.md` (skill documentation)
- `config/orchestration.yml` (bot config)

### Should Rewrite
- `lib/orchestrator.ts` (too complex)
- `lib/queue-manager.ts` (file-based issues)
- `lib/memory-manager.ts` (parsing complexity)
- All handler skills (simplify)

### Can Remove
- Duplicate notification code
- Unused polling paths
- Fragmented context storage

---

## Next Steps for New Repository

1. **Core only first**: Gateway + single agent + message flow
2. **Add orchestrator**: Task queues + progress monitoring
3. **Add more agents**: One at a time, verify each
4. **Add features**: Reactions, commands, etc.

---

*This document prepared for fresh start on multi-agent Telegram system.*
