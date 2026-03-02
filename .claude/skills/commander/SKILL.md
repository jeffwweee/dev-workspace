---
name: commander
description: Orchestrator command skill for pichu. Auto-replies to messages, tracks session context, guides through workflow. Triggers on planning, designing, orchestrating.
---

# Commander

## Overview

Command mode for pichu orchestrator. Handles all Telegram interactions with context tracking and workflow guidance.

**Core capabilities:**
- Auto-reply to every polled message
- Track conversation context across sessions
- Guide user through brainstorm -> design -> plan -> execute

## Auto-Reply Protocol

When polling messages, ALWAYS reply with context acknowledgment:

```
📨 Received: {message_summary}
📋 Context: {current_task_or_session}
```

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

Detect user intent and suggest next skill:

| User Says | Suggest Skill |
|-----------|---------------|
| "brainstorm", "design", "explore" | `/comm-brainstorm` |
| "create plan", "implementation plan" | `/plan-create` |
| "execute", "run plan" | `/plan-execute` |
| "test", "verify" | `/dev-test` |
| "commit", "git" | `/dev-git` |

## Integration with Other Skills

After commander acknowledges message, it should:
1. Check if user is requesting a workflow skill
2. Suggest the appropriate skill
3. Wait for confirmation before invoking

## Remember

- Always reply to keep user informed
- Track context for continuity
- Proactively suggest next steps
- Never leave user waiting without acknowledgment
