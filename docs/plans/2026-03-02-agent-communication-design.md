# Design: Agent Communication & Skill Loading System

**Created:** 2026-03-02
**Status:** Approved
**Author:** pichu (orchestrator)

## Overview

This design defines how agents communicate with the orchestrator and users, and how skills are loaded when agents spawn.

## Problem Statement

1. Agents currently don't send messages back to Telegram
2. Skills defined in config are not being loaded on spawn
3. No standardized notification protocol for task lifecycle events

## Design Decisions

### Decision 1: Task Context Flow

**Chosen approach:** Task context via submit payload

When a task is submitted to the orchestrator, the `chat_id` from the original Telegram message is included in the task payload. This flows through:

1. User sends task request to pichu → message includes `chat_id`
2. Orchestrator submits task with `chatId` in payload
3. Task object stored in queue includes `chatId`
4. Agent receives task context when executing plan
5. Agent uses `/telegram-reply` with `chat_id` from task context

**Implementation:**
- Modify `lib/orchestrator.ts` to include `chatId` in task submission
- Modify `lib/queue-manager.ts` to store `chatId` with task
- Modify `.claude/skills/plan-execute/SKILL.md` to read `chatId` from task context

### Decision 2: Skill Loading

**Chosen approach:** Skills from config only

Skills are defined in `orchestration.yml` under `agent_config.skills` and loaded when agent spawns.

**Skill assignments by role:**

| Role | Bot Name | Skills |
|------|----------|--------|
| orchestrator | pichu | telegram-agent, comm-brainstorm, task-orchestration |
| backend | pikachu | telegram-agent, dev-test, review-code, plan-execute |
| frontend | raichu | telegram-agent, dev-test, review-code |
| qa | bulbasaur | telegram-agent, dev-test, review-verify |
| review-git | charmander | telegram-agent, review-code, dev-git |

**Implementation:**
- Update `orchestration.yml` with complete skill lists
- Modify `lib/spawn-agent.ts` to read skills from config and inject them

### Decision 3: Notification Protocol

**When agents send notifications:**

| Event | When | Template |
|-------|------|----------|
| START | Task execution begins | `Starting TASK-XXX...` |
| PROGRESS | After each batch | `Batch N/M complete: <summary>` |
| BLOCKED | Unresolvable issue | `BLOCKED: <reason>` |
| COMPLETE | All tasks done | `TASK-XXX complete!` |

**Notification mechanism:**
- Agents use `/telegram-reply` with task's `chat_id`
- Orchestrator can also monitor state files for status changes

**Implementation:**
- Update `plan-execute` skill to send notifications at lifecycle events
- Create helper for notification formatting

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Telegram  │────▶│     Pichu        │────▶│  Orchestrator│
│   (User)    │     │  (Orchestrator)  │     │    Loop      │
└─────────────┘     └──────────────────┘     └─────────────┘
                            │                       │
                            │ chat_id               │ taskId + chat_id
                            ▼                       ▼
                     ┌──────────────────────────────────┐
                     │         Task Queue               │
                     │  {id, planPath, chatId, ...}     │
                     └──────────────────────────────────┘
                                     │
                                     │ assign to agent
                                     ▼
                     ┌──────────────────────────────────┐
                     │      Agent (e.g., pikachu)       │
                     │  Skills: telegram-agent,         │
                     │         dev-test, review-code,    │
                     │         plan-execute             │
                     └──────────────────────────────────┘
                                     │
                                     │ /telegram-reply
                                     │ --chat_id <from task>
                                     ▼
                            ┌─────────────┐
                            │   Telegram   │
                            │   (User)     │
                            └─────────────┘
```

## Files to Modify

1. `config/orchestration.yml` - Add complete skill lists per bot
2. `lib/spawn-agent.ts` - Read skills from config, inject on spawn
3. `lib/orchestrator.ts` - Include chatId in task submission
4. `lib/queue-manager.ts` - Store chatId with task
5. `.claude/skills/plan-execute/SKILL.md` - Add notification protocol

## Success Criteria

1. User sends task via Telegram, agent executes and sends progress updates back
2. Newly spawned agents have all required skills loaded
3. Task lifecycle events (start, progress, blocked, complete) trigger Telegram notifications
4. Orchestrator can track task status via state files

## Out of Scope

- Redis pub/sub for real-time events (can add later if needed)
- Group chat support (current design assumes private chat)
- Agent-to-agent communication (agents only communicate via orchestrator or Telegram)
