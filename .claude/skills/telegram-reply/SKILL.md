---
name: telegram-reply
description: "Telegram conversation handler for remote Claude Code control. Polls messages, sends replies with MarkdownV2 formatting, and auto-acks. Use for responding to Telegram messages, sending status updates, or interactive remote work."
---

# Telegram Reply

## Overview

Stateful Telegram conversation tool for remote Claude Code control. Combines poll/send/ack into a single workflow with proper MarkdownV2 formatting.

## Usage

### Poll Messages

Check for new Telegram messages:

```bash
/telegram-reply
```

Returns pending messages with context.

### Send Reply

Reply to the last polled messages:

```bash
/telegram-reply --text "Your message here"
```

### With Template

Use a predefined template:

```bash
/telegram-reply --template status-update
```

## Templates

See [templates.md](./templates.md) for available reply templates.

| Template | Use For |
|----------|---------|
| `ack` | Quick acknowledgment |
| `status-update` | Progress update |
| `ask-clarification` | Request more info |
| `task-complete` | Task completion notice |
| `error-report` | Error notification |
| `waiting` | Waiting for something |

## MarkdownV2 Formatting

This skill automatically escapes MarkdownV2 special characters. See [formatting.md](./formatting.md) for details.

**Safe to use:**
- `*bold*` → **bold**
- `_italic_` → _italic_
- `` `code` `` → `code`
- `[link](url)` → link

**Auto-escaped:**
- `` `_[*~>#+-=|{}.!`` → escaped for Telegram

## Arguments

| Argument | Description | Default |
|----------|-------------|---------|
| `--text` | Reply text to send | (none - polls only) |
| `--template` | Use a template | (none) |
| `--no-ack` | Don't ack messages after sending | false |
| `--no-typing` | Don't show typing indicator | false |

## Return Contract

See [return-contract.md](../references/return-contract.md).

## Example

```
User: /telegram-reply

Status: SUCCESS

Summary:
- Polled 2 messages from Telegram
- Combined context available

Messages:
1. "start work on V2-017" (from user 195061634)
2. "use the new telegram_reply tool" (from user 195061634)

Next recommended:
- Process messages and reply with /telegram-reply --text "..."
```

```
User: /telegram-reply --template task-complete --task V2-017

Status: SUCCESS

Summary:
- Sent reply using template: task-complete
- Acked 2 messages
- Updated reaction to ✅

Message sent:
"✅ Task V2-017 Complete

Summary: Implemented multi-session telegram_reply..."

Next recommended:
- Continue with next task or wait for new messages
```

## Tmux Wake-up

Configure in `config/sessions.json`:

```json
{
  "tmux_wake_command": "/telegram-reply"
}
```

This triggers the skill when Telegram messages arrive.
