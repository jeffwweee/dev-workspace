---
name: commander
description: Orchestrator command skill for pichu. Handles incoming messages, tracks session context, guides through workflow. Triggers on planning, designing, orchestrating.
---

# Commander

## Overview

Command mode for pichu orchestrator. Handles all Telegram interactions with context tracking and workflow guidance.

**Core capabilities:**
- Handle incoming messages (when provided by orchestrator)
- Track conversation context across sessions
- Guide user through brainstorm -> design -> plan -> execute

## Message Context Flow

**IMPORTANT: Message context is handled automatically by the telegram skills.**

1. **Poll**: Orchestrator polls via `telegram-agent --poll`
   - Message is claimed from Redis inbox stream
   - Context (botId, chatId, messageId, etc.) is **automatically stored in Redis**
   - Message is presented to commander skill

2. **Reply**: Commander uses `/telegram-reply` to respond
   - Context is **automatically retrieved from Redis** (no need to pass bot_id, chat_id)
   - Message is sent to Telegram
   - Context is automatically cleaned up

**You never need to manually pass bot_id, chat_id, or messageId - it's all handled via Redis context storage.**

## Message Handling Protocol

When a message is provided (by the orchestrator polling system), handle it appropriately:

1. **Use `/telegram-reply`** to send your response to the user
2. Detect user intent and take action (invoke appropriate skill if needed)
3. Update session state if context changes

**CRITICAL RULES:**
1. **NEVER output "Suggested Skill" or session context to terminal**
2. **ALWAYS use `/telegram-reply`** for all user communication
3. **DO NOT show "Would you like me to:" options** - take action immediately
4. **Silent execution** - only output to user via telegram-reply
5. **DO NOT poll for messages** - wait for orchestrator to provide messages

## Session Tracking

Maintain session state in `state/sessions/{chat_id}.md`:

```markdown
# Session: {chat_id}

## Current Mode
- brainstorming / designing / planning / executing

## Active Task
- TASK-XXX (if any)

## Context
- Key decisions made
- Pending questions
- Next steps
```

## Workflow Guidance

Detect user intent and invoke the appropriate skill immediately:

| User Says | Invoke Skill |
|-----------|-------------|
| "brainstorm", "design", "explore" | `/comm-brainstorm` |
| "create plan", "implementation plan" | `/plan-create` |
| "execute", "run plan" | `/plan-execute` |
| "test", "verify" | `/dev-test` |
| "commit", "git" | `/dev-git` |

After invoking the skill, update the session mode in `state/sessions/{chat_id}.md`.

## Integration with Other Skills

After acknowledging via `/telegram-reply`:
1. Detect user intent from the message
2. Take appropriate action:
   - For brainstorm/design: Immediately invoke `/comm-brainstorm`
   - For planning: Immediately invoke `/plan-create`
   - For execution: Immediately invoke `/plan-execute`
   - For testing: Immediately invoke `/dev-test`
   - For git: Immediately invoke `/dev-git`
3. Update session state file with current mode

**Do not ask for confirmation** - take action based on detected intent.

## Telegram Reply Examples

Context is automatic - just use `/telegram-reply` with your message:

```bash
# Simple acknowledgment
/telegram-reply --template ack

# Inform user of progress
/telegram-reply "I'm looking into that now..."

# Task complete
/telegram-reply "Fixed the bug in lib/orchestrator.ts" --template done

# Need clarification
/telegram-reply "Which file should I modify?" --template clarify

# Error occurred
/telegram-reply "Could not connect to Redis" --template error

# Multi-line response
/telegram-reply "Here's what I found:
1. Issue in spawn-agent.ts line 42
2. Missing context persistence
3. Bash history expansion corrupting text"
```

## Remember

- **Always use `/telegram-reply`** to communicate with the user
- Never output messages to terminal - they won't reach Telegram
- Track context in session state files for continuity
- Take action based on detected intent - don't ask for confirmation
- **DO NOT poll for messages** - wait for orchestrator to provide them
- **Message context (bot_id, chat_id) is automatic - don't pass it manually**
