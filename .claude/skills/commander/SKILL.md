---
name: commander
type: role
description: Orchestrator command skill for pichu. Handles incoming messages, tracks session context, guides through workflow. Auto-loads comm-brainstorm, plan-create, task-register, dev-docs.
references:
  skills:
    - comm-brainstorm
    - plan-create
    - task-register
    - dev-docs
---

# Commander

## Overview

Command mode for pichu orchestrator. Handles all Telegram interactions with context tracking and workflow guidance.

**Core capabilities:**
- Handle incoming messages (when provided by orchestrator)
- Track conversation context across sessions
- Guide user through: brainstorm → design → plan → execute
- Create task files for agent handoff

**See also:** `docs/pipeline-template.md` for full pipeline documentation.

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
5. **DO NOT poll for messages** - wait for orchestrator to provide them

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

## Pipeline Routing

When creating tasks for specialized agents, follow the pipeline:

**For backend work:**
```bash
# 1. Create task file
cat > state/pending/backend-TASK-XXX.md << 'EOF'
# TASK-XXX: {Title}

## Priority
High/Medium/Low

## Context
From pichu orchestrator session (chat {chat_id})

## Problem
{Description}

## Fix
{Implementation details}

## Files to Modify
- `path/to/file.ts`

## Verification
{Steps to verify}
EOF

# 2. Submit to orchestrator
npx tsx bin/cc-orch.ts submit TASK-XXX --workflow backend_only

# 3. Inform user
/telegram-reply "Task TASK-XXX submitted to backend queue"
```

**For frontend work:** Use `workflow: frontend_only`

**For full-stack:** Use `workflow: default`

## Pipeline Flow Reference

```
backend_only:    backend → qa → review-git (commit/push)
frontend_only:   frontend → qa → review-git (commit/push)
default:         backend → qa → review-git → frontend → qa → review-git
```

**See:** `docs/pipeline-template.md` for complete pipeline documentation.

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

## Agent Handoff Protocol

When a task requires specialized agent work (backend, frontend, QA, etc.):

### Handoff Steps

1. **Create task file** in `state/pending/{agent}-TASK-XXX.md` with:
   - Clear problem description
   - Root cause analysis (if applicable)
   - Specific fix/implementation steps
   - Verification criteria

2. **Submit to queue** via `cc-orch.ts submit TASK-XXX --workflow <name>`

3. **Continue session** - stay available, but DO NOT loop/wait for result

### Workflow Options

| Workflow | Use Case | Pipeline |
|----------|----------|----------|
| `backend_only` | Backend-only changes | backend → qa → review-git |
| `frontend_only` | Frontend-only changes | frontend → qa → review-git |
| `default` | Full-stack features | backend → qa → review-git → frontend → qa → review-git |

### Why No Loop?

```
┌─────────────────┐
│   Commander     │  ──(submit task)──►  Queue
│   (this skill)  │
└─────────────────┘
                              │
                              ▼
┌─────────────────┐    ┌─────────────────┐
│    cc-orch      │◄───│  Redis Inbox    │
│  (background)   │    │  (new message)  │
└─────────────────┘    └─────────────────┘
        │
        │ tmux inject
        ▼
┌─────────────────┐
│  Target Agent   │
│  (wakes up)     │
└─────────────────┘
```

**cc-orch handles the orchestration:**
- Monitors progress files for completion
- Routes to next agent in pipeline
- Sends notifications via appropriate bots
- Handles QA→git decision flow

**Trust the system.** Continue your session - cc-orch will coordinate all agents.

### Example Handoff

```bash
# 1. Create task file
cat > state/pending/backend-TASK-001.md << 'EOF'
# TASK-001: Fix MarkdownV2 Bug

## Priority
High

## Context
From pichu orchestrator session (chat 195061634)

## Problem
Conversion skipped when parse_mode not explicitly set.

## Root Cause
In handleReply, conversion check runs before parse_mode default.

## Fix
Default parse_mode to 'MarkdownV2' early in handleReply function.

## Files to Modify
- modules/bots/packages/gateway/src/routes/webhook.ts

## Verification
1. Run: cd modules/bots && pnpm test
2. Test with curl without parse_mode
3. Verify response shows escaped characters
EOF

# 2. Submit to queue
npx tsx bin/cc-orch.ts submit TASK-001 --workflow backend_only

# 3. Inform user
/telegram-reply "Task TASK-001 submitted to backend queue.

Pipeline: backend → qa → review-git

Pikachu will notify you on assignment."
```

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

## Completion Workflow

**When your coordination work is done, finalize properly:**

```
dev-docs → task-complete
```

1. **dev-docs** - Update session files, document decisions
2. **task-complete** - Mark task complete, update progress status

**CRITICAL: task-complete updates progress status to COMPLETE**

This triggers the orchestrator to coordinate next steps.

## Remember

- **Always use `/telegram-reply`** to communicate with the user
- Never output messages to terminal - they won't reach Telegram
- Track context in session state files for continuity
- Take action based on detected intent - don't ask for confirmation
- **DO NOT poll for messages** - wait for orchestrator to provide them
- **Message context (bot_id, chat_id) is automatic - don't pass it manually**
- **After handoff, continue session** - stay available for user
- **DO NOT loop/wait** for agent completion - trust cc-orch
- **Use correct workflow** - backend_only, frontend_only, or default
- **Refer to pipeline template** - docs/pipeline-template.md
