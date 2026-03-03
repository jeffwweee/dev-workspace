# tg-bots v3 Design Document

> Telegram Bot Gateway for Claude Code multi-session orchestration

**Created:** 2026-02-24
**Status:** Approved
**Target:** MVP - N bots ↔ N sessions + group chat with mentions + reply threading

---

## Overview

tg-bots v3 is a Telegram integration module that enables multiple Claude Code sessions to be controlled remotely via Telegram bots. It provides reliable message routing, group chat support, and reply threading.

### Goals

1. **N bots ↔ N sessions** - Config-driven 1:1 mapping between Telegram bots and tmux sessions
2. **Group chat support** - Bots respond when mentioned in group chats
3. **Reply threading** - Responses threaded under original messages for context
4. **Reliable delivery** - Redis-backed durable queues with ack semantics
5. **Modular architecture** - Developed separately, integrated as git submodule

### Non-Goals (Future)

- Context/task-aware routing (one bot, multiple sessions)
- Multi-platform support (Discord, WhatsApp)
- Advanced permissions and security tiers

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           TELEGRAM                                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ webhook
┌─────────────────────────────────────────────────────────────────────────┐
│  GATEWAY (PM2)                                                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                  │
│  │ Webhook     │───▶│ Router      │───▶│ Inbox       │                  │
│  │ Receiver    │    │ (bot→sess)  │    │ (Redis)     │                  │
│  └─────────────┘    └─────────────┘    └──────┬──────┘                  │
│                                               │                          │
│  ┌─────────────┐    ┌─────────────┐           │ XADD tg:inbox           │
│  │ Outbox      │◀───│ Telegram    │           │                          │
│  │ Listener    │    │ Sender      │           ▼                          │
│  └──────┬──────┘    └─────────────┘    ┌─────────────┐                  │
│         │ SUBSCRIBE                      │ Redis       │                  │
│         │ tg:outbox                      │ Streams     │                  │
│         │                                └─────────────┘                  │
└─────────│─────────────────────────────────────────────────────────────────┘
          │ tmux send-keys "/telegram-reply"
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  TMUX SESSIONS                                                          │
│                                                                         │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐       │
│  │ cc-alpha         │  │ cc-beta          │  │ cc-gamma         │       │
│  │ (bot: alpha-bot) │  │ (bot: beta-bot)  │  │ (bot: gamma-bot) │       │
│  │                  │  │                  │  │                  │       │
│  │ /telegram-reply ─│──│──▶ processes     │  │                  │       │
│  │        │         │  │    message       │  │                  │       │
│  │        ▼         │  │        │         │  │                  │       │
│  │ XREADGROUP      │  │        ▼         │  │                  │       │
│  │ process reply   │  │ PUBLISH          │  │                  │       │
│  │ PUBLISH outbox  │  │ tg:outbox        │  │                  │       │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘       │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Components

| Component | Responsibility |
|-----------|----------------|
| **Gateway** | Receives webhooks, routes to sessions, sends outbound messages |
| **Redis Streams (inbox)** | Durable message queue, dedupe by update_id, claim/ack semantics |
| **Redis Pub/Sub (outbox)** | Fire-and-forget reply channel to gateway |
| **tmux sessions** | Claude Code instances, woken by `/telegram-reply` injection |
| **telegram-reply skill** | Polls inbox, presents to CC, writes to outbox |

---

## 2. Message Flow

### Inbound Flow (Telegram → Session)

```
1. User sends message in Telegram (DM or group chat with bot mention)
                    │
                    ▼
2. Telegram POSTs to webhook endpoint (e.g., https://your-domain.com/webhook/:botId)
                    │
                    ▼
3. Gateway receives webhook
   ├── Validates bot token / signature
   ├── Checks allowlist (allowed_chats, admin_users)
   ├── Extracts: update_id, chat_id, user_id, text, reply_to_message_id
   └── For group chats: filters only messages where bot is mentioned
                    │
                    ▼
4. Gateway writes to Redis Stream
   XADD tg:inbox * bot_id "alpha-bot" chat_id 123 update_id 456 text "hello" reply_to 789
                    │
                    ▼
5. Gateway injects wake command to linked tmux session
   tmux send-keys -t cc-alpha:0.0 "/telegram-reply\n"
                    │
                    ▼
6. telegram-reply skill executes in CC session
   ├── XREADGROUP to claim pending message
   ├── Presents message context to CC
   └── CC processes and generates response
```

### Outbound Flow (Session → Telegram)

```
1. CC session ready to reply
                    │
                    ▼
2. telegram-reply skill writes to Redis Pub/Sub
   PUBLISH tg:outbox '{"bot_id":"alpha-bot","chat_id":123,"text":"Done!","reply_to":456}'
                    │
                    ▼
3. Gateway (subscribed to tg:outbox) receives message
   ├── Looks up bot token from config
   ├── Formats message (MarkdownV2 escaping)
   ├── Sends via Telegram API with reply_to_message_id for threading
   └── On success: XACK the inbox message (marks as processed)
                    │
                    ▼
4. Reply appears in Telegram, threaded under original message
```

### Error Handling

| Scenario | Behavior |
|----------|----------|
| Telegram send fails | Gateway retries 3x with backoff, then logs error |
| Message claim timeout | Message returns to pending after 30s, can be re-claimed |
| Duplicate webhook | Deduped by `update_id` in Redis stream |
| Session not responding | Message stays in inbox, no ack until processed |

---

## 3. Config File Schema

**Location:** `dev-workspace/config/bots.yaml`

```yaml
# Telegram Bot Gateway Configuration
# Version: 1.0.0

# Gateway settings
gateway:
  port: 3100
  host: "0.0.0.0"
  redis:
    url: "redis://localhost:6379"
    inbox_stream: "tg:inbox"
    outbox_channel: "tg:outbox"
  message:
    claim_timeout_ms: 30000      # 30s before message returns to pending
    max_retries: 3
    retry_delay_ms: 1000

# Bot definitions
bots:
  - name: "alpha-bot"
    # Telegram bot token (can use env var reference)
    token: "${TELEGRAM_BOT_ALPHA_TOKEN}"

    # Webhook path: /webhook/alpha-bot
    webhook_path: "/webhook/alpha-bot"

    # Linked tmux session
    tmux:
      session: "cc-alpha"
      window: 0
      pane: 0

    # Wake command injected into tmux
    wake_command: "/telegram-reply"

    # Permission controls
    permissions:
      # Chat IDs allowed to interact (positive = user, negative = group)
      allowed_chats: [123456789, -1001234567890]

      # User IDs with admin privileges (can run privileged commands)
      admin_users: [123456789]

      # Rate limiting (per chat)
      rate_limit:
        max_messages: 10
        window_seconds: 60

  - name: "beta-bot"
    token: "${TELEGRAM_BOT_BETA_TOKEN}"
    webhook_path: "/webhook/beta-bot"
    tmux:
      session: "cc-beta"
      window: 0
      pane: 0
    wake_command: "/telegram-reply"
    permissions:
      allowed_chats: []          # Empty = allow all
      admin_users: [987654321]
      rate_limit:
        max_messages: 20
        window_seconds: 60

# Logging configuration
logging:
  level: "info"                  # debug, info, warn, error
  format: "json"                 # json, pretty
  file: "/var/log/tg-gateway.log"
```

**Environment Variables (required):**
```bash
# In .env or shell profile
TELEGRAM_BOT_ALPHA_TOKEN=123456:ABC-DEF...
TELEGRAM_BOT_BETA_TOKEN=789012:XYZ-UVW...
```

---

## 4. Directory Structure

### Development Repo (`tg-bots`)

```
tg-bots/
├── packages/
│   ├── gateway/                      # Telegram webhook service
│   │   ├── src/
│   │   │   ├── index.ts              # Entry point
│   │   │   ├── server.ts             # HTTP server (Express/Fastify)
│   │   │   ├── routes/
│   │   │   │   └── webhook.ts        # POST /webhook/:botId
│   │   │   ├── services/
│   │   │   │   ├── inbox.ts          # Redis Streams writer
│   │   │   │   ├── outbox.ts         # Redis Pub/Sub listener + sender
│   │   │   │   ├── router.ts         # Bot→session routing
│   │   │   │   └── telegram.ts       # Telegram API client
│   │   │   ├── middleware/
│   │   │   │   └── validate.ts       # Webhook signature, allowlist
│   │   │   └── utils/
│   │   │       ├── markdown.ts       # MarkdownV2 escaping
│   │   │       └── logger.ts         # Structured logging
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── skills/                       # Claude Code skills
│   │   ├── src/
│   │   │   └── telegram-reply/
│   │   │       ├── SKILL.md          # Skill definition
│   │   │       ├── index.ts          # Skill logic
│   │   │       ├── inbox-client.ts   # Redis Stream reader
│   │   │       └── outbox-client.ts  # Redis Pub/Sub publisher
│   │   └── package.json
│   │
│   └── shared/                       # Shared utilities
│       ├── src/
│       │   ├── types.ts              # TypeScript interfaces
│       │   ├── config.ts             # Config loader (YAML)
│       │   ├── redis.ts              # Redis client factory
│       │   └── constants.ts          # Shared constants
│       └── package.json
│
├── config/
│   ├── bots.example.yaml             # Example config
│   └── pm2.ecosystem.config.js       # PM2 config
│
├── scripts/
│   ├── build.sh                      # Build all packages
│   └── install-to-workspace.sh       # Copy to dev-workspace
│
├── package.json                      # Monorepo root (workspaces)
├── tsconfig.base.json                # Shared TS config
├── .env.example
└── README.md
```

### Integrated into dev-workspace (via submodule)

```
dev-workspace/
├── modules/
│   └── bots/                         # git submodule → tg-bots
│       └── ...                       # (same structure as above)
│
├── config/
│   └── bots.yaml                     # User's actual config
│
├── .claude/
│   └── skills/
│       └── telegram-reply/           # Symlink or copied from modules/bots
│           └── SKILL.md
│
└── .claude/
    └── commands/
        └── telegram-reply.md         # /telegram-reply command
```

---

## 5. Key Interfaces & Types

```typescript
// packages/shared/src/types.ts

// === Config Types ===

export interface BotConfig {
  name: string;
  token: string;                    // or env var reference "${VAR}"
  webhook_path: string;
  tmux: TmuxTarget;
  wake_command: string;
  permissions: Permissions;
}

export interface TmuxTarget {
  session: string;
  window: number;
  pane: number;
}

export interface Permissions {
  allowed_chats: number[];          // empty = allow all
  admin_users: number[];
  rate_limit?: RateLimit;
}

export interface RateLimit {
  max_messages: number;
  window_seconds: number;
}

export interface GatewayConfig {
  port: number;
  host: string;
  redis: RedisConfig;
  message: MessageConfig;
}

export interface RedisConfig {
  url: string;
  inbox_stream: string;             // default: "tg:inbox"
  outbox_channel: string;           // default: "tg:outbox"
}

export interface MessageConfig {
  claim_timeout_ms: number;
  max_retries: number;
  retry_delay_ms: number;
}

// === Message Types ===

export interface InboxMessage {
  id: string;                       // Redis stream entry ID
  bot_id: string;
  chat_id: number;
  user_id: number;
  update_id: number;                // Telegram update_id (dedupe key)
  text: string;
  reply_to?: number;                // Original message ID for threading
  username?: string;
  chat_type: 'private' | 'group' | 'supergroup';
  timestamp: number;
}

export interface OutboxMessage {
  bot_id: string;
  chat_id: number;
  text: string;
  reply_to?: number;                // For threading
  parse_mode?: 'MarkdownV2' | 'HTML' | null;
  inbox_id?: string;                // Reference to ack after send
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  // ... other update types as needed
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  text?: string;
  reply_to_message?: TelegramMessage;
  entities?: TelegramEntity[];      // For mentions, commands, etc.
}

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
}

export interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
}

export interface TelegramEntity {
  type: 'mention' | 'bot_command' | 'text_mention' | string;
  offset: number;
  length: number;
}

// === API Response Types ===

export interface SendResult {
  success: boolean;
  message_id?: number;
  error?: string;
}

export interface ClaimResult {
  claimed: boolean;
  message?: InboxMessage;
  error?: string;
}
```

---

## 6. Implementation Phases

### Phase 1: Foundation (Core Infrastructure)
**Goal:** Get basic message flow working end-to-end

| Task | Description |
|------|-------------|
| 1.1 | Set up monorepo structure with packages (gateway, skills, shared) |
| 1.2 | Implement `shared` package: types, config loader, Redis client |
| 1.3 | Implement gateway webhook receiver (basic POST handler) |
| 1.4 | Implement inbox writer (Redis Streams XADD) |
| 1.5 | Implement tmux injection (send-keys) |
| 1.6 | Implement basic `telegram-reply` skill (XREADGROUP, present message) |
| 1.7 | Implement outbox writer (Redis PUBLISH) |
| 1.8 | Implement gateway outbox listener + Telegram sender |
| 1.9 | Add message ack (XACK after successful send) |

**Milestone:** Single bot → single session, DM only, no threading

---

### Phase 2: Multi-Bot & Routing
**Goal:** Support N bots ↔ N sessions

| Task | Description |
|------|-------------|
| 2.1 | Implement config loader (bots.yaml parsing, env var expansion) |
| 2.2 | Implement bot router (lookup bot by webhook_path) |
| 2.3 | Add bot token per-config (send with correct bot identity) |
| 2.4 | Test with 2+ bots and 2+ sessions |

**Milestone:** Multiple bots, each linked to their own session

---

### Phase 3: Group Chat & Threading
**Goal:** Support group chats with mentions and reply threading

| Task | Description |
|------|-------------|
| 3.1 | Add mention detection (parse entities, filter bot username) |
| 3.2 | Implement reply threading (store reply_to, use in send) |
| 3.3 | Add group chat allowlist filtering |
| 3.4 | Test group chat scenarios |

**Milestone:** Group chats work, replies threaded correctly

---

### Phase 4: Reliability & Polish
**Goal:** Production-ready

| Task | Description |
|------|-------------|
| 4.1 | Add deduplication (check update_id before XADD) |
| 4.2 | Add claim timeout / auto-requeue (XPENDING + XCLAIM) |
| 4.3 | Add retry logic for Telegram API failures |
| 4.4 | Add rate limiting (per chat) |
| 4.5 | Add structured logging (JSON, levels) |
| 4.6 | Add PM2 ecosystem config |
| 4.7 | Write README and deployment docs |

**Milestone:** Production-ready gateway

---

### Phase 5: Integration with dev-workspace
**Goal:** Bundle as submodule

| Task | Description |
|------|-------------|
| 5.1 | Add as git submodule to `dev-workspace/modules/bots` |
| 5.2 | Create symlink script for skills → `.claude/skills/` |
| 5.3 | Add CLI commands to `dw.js` for bots management |
| 5.4 | Test full integration |

**Milestone:** Integrated into dev-workspace

---

### Summary

| Phase | Focus | Key Deliverable |
|-------|-------|-----------------|
| 1 | Foundation | Single bot, DM, end-to-end flow |
| 2 | Multi-Bot | N bots ↔ N sessions |
| 3 | Group Chat | Mentions + threading |
| 4 | Reliability | Production-ready |
| 5 | Integration | Bundled in dev-workspace |

---

## Technical Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Config format | YAML | More readable for complex configs |
| Inbox queue | Redis Streams | Durable, consumer groups, ack semantics |
| Outbound channel | Redis Pub/Sub | Fire-and-forget, gateway is single sender |
| Wake mechanism | tmux send-keys | Direct, reliable |
| Wake command | `/telegram-reply` | Leverages existing skill pattern |
| Runtime | PM2 | Process management, auto-restart, logs |
| Deployment | Git submodule | Develop separately, integrate on release |

---

## Future Evolution (Post-MVP)

1. **Context-aware routing** - One bot, multiple sessions, task-based dispatch
2. **Multi-platform** - Add Discord, WhatsApp support
3. **Enhanced permissions** - Role-based access, rate limits per user
4. **Monitoring dashboard** - Real-time message flow visualization
5. **Project Wingman** - Full orchestrator with agent spawning
