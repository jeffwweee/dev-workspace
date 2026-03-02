---
name: agent-notify
description: Agent notification skill. Sends agent-identity-aware notifications via Telegram through assigned bot. Auto-loads with agent roles.
references:
  skills: []
---

# Agent Notify

## Overview

Send notifications from agents with proper identity through their assigned Telegram bot.

**Each agent speaks for itself:**
- Pikachu (pikachu_cc_bot): "Pikachu received backend task TASK-001"
- Bulbasaur (bulbasaur_cc_bot): "Bulbasaur completed QA for TASK-002"
- Raichu (raichu_cc_bot): "Raichu needs help with..."

## Agent Identity

Agent identity is determined from `config/orchestration.yml`:

| Agent | Bot | Role |
|-------|-----|------|
| pichu | pichu_cc_bot | orchestrator |
| pikachu | pikachu_cc_bot | backend |
| raichu | raichu_cc_bot | frontend |
| bulbasaur | bulbasaur_cc_bot | qa |
| charmander | charmander_cc_bot | review-git |

**The skill auto-detects your bot from the role mapping.**

## Notification Templates

**To invoke the notification command:**

```bash
npx tsx bin/agent-notify.ts <command> [options]
```

### 1. Task Assignment

Use when a task is assigned to the agent:

```bash
npx tsx bin/agent-notify.ts assignment TASK-XXX
```

**Message sent:**
```
📥 <BotName> received <role> task TASK-XXX

<task title from state/pending/{role}-TASK-XXX.md>
```

**Example:**
```
📥 Pikachu received backend task TASK-001

Fix MarkdownV2 Conversion Bug in Gateway
```

### 2. Task Completion

Use when a task is completed:

```bash
npx tsx bin/agent-notify.ts complete TASK-XXX --details
```

**Message sent:**
```
✅ <BotName> completed TASK-XXX

<summary from state/progress/TASK-XXX.md>

<details if --details flag>
```

**Example (without --details):**
```
✅ Pikachu completed TASK-001
```

**Example (with --details):**
```
✅ Pikachu completed TASK-001

Fixed MarkdownV2 conversion bug in gateway.
Files changed: modules/bots/packages/gateway/src/routes/webhook.ts
Duration: 5 minutes
```

### 3. Request Assistance

Use when stuck and need human help:

```bash
npx tsx bin/agent-notify.ts help "Unclear requirement" --task TASK-XXX
```

**Message sent:**
```
🆘 <BotName> needs help

<reason>

<Task info if --task provided>
```

**Example:**
```
🆘 Pikachu needs help

Unclear requirement: Should parse_mode default to MarkdownV2 or null?

Task: TASK-001 - Fix MarkdownV2 Conversion Bug
```

### 4. Status Update

Use for progress updates:

```bash
npx tsx bin/agent-notify.ts status "Running tests..." --task TASK-XXX
```

**Message sent:**
```
🔄 <BotName> status update

<message>
```

**Example:**
```
🔄 Pikachu status update

Running tests for TASK-001...
```

## How It Works

**Under the hood, the skill:**

1. **Reads orchestration config** - Gets bot token for current agent's role
2. **Reads task/progress files** - Extracts context for detailed messages
3. **Publishes to Redis outbox** - Uses proven outbox pattern
4. **Gateway delivers to Telegram** - Via agent's assigned bot

## Protocol

When working on a task, notify at key points:

```
┌─────────────────────────────────────────────────────────────┐
│  START:  npx tsx bin/agent-notify.ts assignment TASK-XXX    │
├─────────────────────────────────────────────────────────────┤
│  WORK:   (do the work...)                                   │
├─────────────────────────────────────────────────────────────┤
│  STUCK?  npx tsx bin/agent-notify.ts help "reason" --task X │
├─────────────────────────────────────────────────────────────┤
│  UPDATE: npx tsx bin/agent-notify.ts status "progress"      │
├─────────────────────────────────────────────────────────────┤
│  DONE:   npx tsx bin/agent-notify.ts complete TASK-XXX -d   │
└─────────────────────────────────────────────────────────────┘
```

## Backend Handler Integration

The `backend-handler` skill automatically includes notification steps:

1. **On task start:** Calls `npx tsx bin/agent-notify.ts assignment TASK-XXX`
2. **On completion:** Calls `npx tsx bin/agent-notify.ts complete TASK-XXX --details`
3. **On block:** Calls `npx tsx bin/agent-notify.ts help "reason" --task TASK-XXX`

## Implementation Notes

**To send a notification, publish to Redis outbox:**

```json
{
  "bot_id": "<agent role from config>",
  "chat_id": 195061634,
  "text": "<formatted message>",
  "parse_mode": "MarkdownV2"
}
```

The gateway subscribes to the outbox channel and delivers to Telegram.

**Role to bot_id mapping:**
- orchestrator → pichu
- backend → pikachu
- frontend → raichu
- qa → bulbasaur
- review-git → charmander

## Remember

- **Notifications use the agent's assigned bot** - Not the orchestrator
- **Context is pulled from task/progress files** - Keep them updated
- **Use templates for consistency** - assignment, complete, help, status
- **Notify on assignment, progress, blocks, and completion** - Keep user informed
