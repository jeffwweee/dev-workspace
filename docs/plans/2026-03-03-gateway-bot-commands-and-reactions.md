# Gateway Bot Commands and Reactions

**Date:** 2026-03-03
**Branch:** `feature/gateway-enhancements`
**Status:** Planning

## Overview

Enhance the Telegram bot gateway with interactive commands and message reactions for better user feedback and control.

---

## 1. Bot Commands

Add `/` commands for bot control and status visibility.

### Commands

| Command | Description |
|---------|-------------|
| `/interrupt` | Cancel current task/operation for the agent |
| `/clear` | Clear agent's context or reset state |
| `/compact` | Trigger context compaction to save tokens |
| `/status` | Show current agent status (busy, idle, task in progress) |
| `/list` | List pending tasks in queue |

### Implementation Notes

- Commands should be processed by gateway before/after message handling
- Only allowed users (admin_users) can trigger commands
- Responses should use reactions or short reply messages
- Consider rate limiting to prevent spam

### API Flow

```
User sends: /status
Gateway receives -> Validates user -> Queries agent state -> Replies with status
```

### Response Format

```json
{
  "chat_id": 195061634,
  "text": "*Status:* Idle\n*Queue:* 2 tasks\n*Last activity:* 5 min ago",
  "parse_mode": "MarkdownV2"
}
```

---

## 2. Message Reactions

Add emoji reactions to messages as visual feedback after acknowledgment.

### Reaction Types

| Reaction | Meaning |
|----------|---------|
| 👀 | Acknowledged / Seen |
| 🔄 | Processing / In Progress |
| ✅ | Completed Successfully |
| ❌ | Failed / Error |
| ⏸️ | Paused / Waiting for input |
| 📋 | Task queued |

### Flow

1. User sends message to bot
2. Bot reacts with 👀 (acknowledged)
3. Bot processes message
4. Bot updates reaction:
   - 🔄 if task is long-running
   - ✅ on success
   - ❌ on failure

### Implementation Notes

- Use Telegram's `setMessageReaction` API
- Reactions are less intrusive than reply messages
- Can combine with reply for detailed feedback
- Consider removing reaction after final reply

### API Reference

```typescript
// Set reaction
await bot.api.setMessageReaction(chat_id, message_id, {
  reaction: [{ type: "emoji", emoji: "👀" }]
});
```

---

## Technical Design

### Gateway Changes

```
packages/gateway/src/
├── commands/
│   ├── index.ts           # Command router
│   ├── interrupt.ts       # /interrupt handler
│   ├── clear.ts           # /clear handler
│   ├── compact.ts         # /compact handler
│   ├── status.ts          # /status handler
│   └── list.ts            # /list handler
├── reactions/
│   ├── index.ts           # Reaction manager
│   └── types.ts           # Reaction type definitions
└── routes/
    └── webhook.ts         # Add command/reaction handling
```

### Message Flow

```
Incoming Message
       │
       ▼
┌──────────────┐
│  Is Command? │──Yes──▶ Command Handler ──▶ Reply/Reaction
└──────────────┘
       │ No
       ▼
┌──────────────┐
│   Add 👀     │
│  Reaction    │
└──────────────┘
       │
       ▼
┌──────────────┐
│   Process    │
│   Message    │
└──────────────┘
       │
       ▼
┌──────────────┐
│  Update to   │
│  ✅ or ❌    │
└──────────────┘
```

---

## Tasks

- [ ] Add command handler infrastructure
- [ ] Implement `/status` command
- [ ] Implement `/list` command
- [ ] Implement `/interrupt` command
- [ ] Implement `/clear` command
- [ ] Implement `/compact` command
- [ ] Add reaction manager
- [ ] Integrate reactions with message flow
- [ ] Add tests for commands
- [ ] Add tests for reactions
- [ ] Update documentation

---

## Decisions

1. **Reactions:** Keep after completion (don't remove)
2. **`/interrupt`:** Behaves like `/stop` - inject into tmux to stop the agent directly
3. **`/compact`:** Manual only (skill-based context compacting in progress)

---

## 3. Image and File Processing

Handle incoming images and files from Telegram messages.

### Supported Types

| Type | MIME | Handling |
|------|------|----------|
| Images | `image/*` | Download, analyze, or forward to agent |
| Documents | `application/*` | Download, extract text if possible |
| Videos | `video/*` | Download, extract frames or metadata |
| Audio | `audio/*` | Download, transcribe if needed |

### Flow

```
User sends photo/document
        │
        ▼
┌─────────────────┐
│ Gateway receives │
│ file_id          │
└─────────────────┘
        │
        ▼
┌─────────────────┐
│ Download file   │
│ via Telegram API│
└─────────────────┘
        │
        ▼
┌─────────────────┐
│ Store in tmp/   │
│ or process      │
└─────────────────┘
        │
        ▼
┌─────────────────┐
│ Include in      │
│ agent message   │
└─────────────────┘
```

### Implementation

```typescript
interface FileMessage {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  file_name?: string;
  mime_type?: string;
}

// Download file
const file = await bot.api.getFile(file_id);
const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

// Include in context
const context = {
  type: 'file',
  url: fileUrl,
  localPath: `/tmp/${file_id}`,
  mimeType: mime_type,
  fileName: file_name
};
```

---

## 4. Replies with Attachments

Send actual file attachments instead of file paths in responses.

### Current Behavior

```
Agent: "Here's the file: /home/user/output/report.pdf"
```

### New Behavior

```
Agent sends document directly as Telegram attachment
```

### Implementation

```typescript
// Outbox message with attachment
interface OutboxMessage {
  chat_id: number;
  text?: string;
  attachment?: {
    type: 'document' | 'photo' | 'video' | 'audio';
    path: string;  // Local file path
    filename?: string;
    caption?: string;
  };
}

// Send attachment
await bot.api.sendDocument(chat_id, {
  source: fs.readFileSync(attachment.path),
  filename: attachment.filename,
  caption: attachment.caption,
  parse_mode: 'MarkdownV2'
});
```

### Gateway Changes

- Detect file paths in agent responses
- Convert valid paths to attachments
- Support multiple attachment types
- Handle file size limits (50MB for documents)

### Detection Pattern

```typescript
// Patterns to detect file references
const filePatterns = [
  /(?:file|output|saved|written to|created):\s*(`?[\w\/\-. ]+`?)/gi,
  /```\n?(\/[\w\/\-. ]+\.\w+)\n?```/g,
  /\[([^\]]+)\]\((\/[\w\/\-. ]+)\)/g,
];
```

---

## 5. Threading/Reply for Context

Use Telegram reply threads to maintain conversation context.

### Purpose

- Group related messages in threads
- Provide context for agent responses
- Allow parallel conversations per task

### Flow

```
User message (topic: TASK-001)
        │
        ▼
┌─────────────────────────┐
│ Agent replies in thread │
│ (reply_to_message_id)   │
└─────────────────────────┘
        │
        ▼
┌─────────────────────────┐
│ All TASK-001 messages   │
│ stay in same thread     │
└─────────────────────────┘
```

### Implementation

```typescript
interface ThreadContext {
  root_message_id: number;  // Original message that started thread
  topic?: string;           // e.g., "TASK-001"
  last_message_id: number;  // For continuous threading
}

// Reply in thread
await bot.api.sendMessage(chat_id, text, {
  reply_to_message_id: threadContext.root_message_id,
  parse_mode: 'MarkdownV2'
});
```

### Thread Management

```typescript
// Redis key for thread tracking
const threadKey = `tg:thread:${chat_id}:${topic}`;

// Store thread root
await redis.set(threadKey, root_message_id, 'EX', 86400);  // 24h TTL

// Get thread for topic
const rootId = await redis.get(threadKey);
```

### Context Injection

When agent receives a reply, include thread history:

```typescript
const threadHistory = await getThreadMessages(chat_id, root_message_id);
const context = {
  thread: {
    root_id: root_message_id,
    message_count: threadHistory.length,
    summary: summarizeThread(threadHistory)
  }
};
```

---

## 6. Commands Sync to Telegram

Register bot commands with Telegram for autocomplete and discovery.

### Purpose

- Commands appear in Telegram's "/" menu with descriptions
- Autocomplete helps users discover available commands
- Consistent UX with other Telegram bots

### Implementation

```typescript
// Sync commands to Telegram BotFather
await bot.api.setMyCommands([
  { command: "status", description: "Show agent status" },
  { command: "list", description: "List pending tasks" },
  { command: "interrupt", description: "Cancel current task" },
  { command: "clear", description: "Clear agent context" },
  { command: "compact", description: "Trigger context compaction" },
]);
```

### Sync Flow

```
Gateway starts
      │
      ▼
┌─────────────────┐
│ Load commands   │
│ from config     │
└─────────────────┘
      │
      ▼
┌─────────────────┐
│ Call BotFather  │
│ setMyCommands() │
└─────────────────┘
      │
      ▼
┌─────────────────┐
│ Commands appear │
│ in / menu       │
└─────────────────┘
```

### Tasks

- [ ] Create commands registry
- [ ] Add sync on gateway startup
- [ ] Add manual sync endpoint
- [ ] Support per-bot command sets

---

## Testing Environment

**CRITICAL: Local testing only - no production services**

### Configuration

| Setting | Value | Reason |
|---------|-------|--------|
| Gateway Port | `3001` | Avoid conflict with production (3100) |
| Redis DB | `1` | Separate from production |
| Bot Token | Test bot token | Never use production bot |
| Admin Users | Test user IDs only | Isolate access |

### Test Setup

```bash
# Start gateway on test port
GATEWAY_PORT=3001 REDIS_DB=1 tsx packages/gateway/src/index.ts

# Or with environment file
cp .env.test.example .env.test
tsx packages/gateway/src/index.ts
```

### Test Checklist

- [ ] All commands work on port 3001
- [ ] No connection to production Redis
- [ ] No production bot tokens in test runs
- [ ] Verify with `curl localhost:3001/health`

---

## Updated Tasks

### Phase 1: Commands
- [ ] Add command handler infrastructure
- [ ] Implement `/status` command
- [ ] Implement `/list` command
- [ ] Implement `/interrupt` command (tmux injection)
- [ ] Implement `/clear` command
- [ ] Implement `/compact` command (manual trigger)

### Phase 2: Reactions
- [ ] Add reaction manager
- [ ] Integrate reactions with message flow
- [ ] Map reactions to message states

### Phase 3: File Processing
- [ ] Add file download handler
- [ ] Support image processing
- [ ] Support document processing
- [ ] Include files in agent context

### Phase 4: Attachments
- [ ] Detect file paths in responses
- [ ] Convert paths to attachments
- [ ] Handle file size limits
- [ ] Support multiple attachment types

### Phase 5: Threading
- [ ] Add thread tracking (Redis)
- [ ] Implement reply_to_message_id
- [ ] Thread context injection
- [ ] Thread summarization

### Phase 6: Commands Sync
- [ ] Create commands registry
- [ ] Add sync on gateway startup
- [ ] Add manual sync endpoint
- [ ] Support per-bot command sets

### Testing & Docs
- [ ] Set up test environment (port 3001)
- [ ] Add tests for all features
- [ ] Update API documentation
- [ ] Update user guide

---

## Open Questions

1. Rate limiting strategy for commands?
