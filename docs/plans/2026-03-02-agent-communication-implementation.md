# Agent Communication & Skill Loading Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `plan-execute` or `plan-parallel` skill to implement this plan task-by-task.

**Goal:** Enable agents to send Telegram notifications and auto-load skills from config.

**Architecture:** Task context (chat_id) flows through task submission → queue → agent execution. Skills are read from orchestration.yml and injected on agent spawn. Notification protocol added to plan-execute skill.

**Tech Stack:** TypeScript, Node.js, YAML config, file-based state management

---

## Task 1: Add chatId to QueueTask Interface

**Files:**
- Modify: `lib/queue-manager.ts:10-20`

**Step 1: Add chatId to QueueTask interface**

Add `chatId` field to the `QueueTask` interface:

```typescript
export interface QueueTask {
  id: string;
  description?: string;
  workflow?: string;
  planPath?: string;
  handoffPath?: string;
  handoffFrom?: string;
  priority?: number;
  enqueued_at?: string;
  position?: number;
  chatId?: number;  // Telegram chat ID for notifications
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit lib/queue-manager.ts 2>&1 | head -5`
Expected: May show pre-existing errors (import.meta), but no new errors about chatId

**Step 3: Commit**

```bash
git add lib/queue-manager.ts
git commit -m "feat(queue): add chatId field to QueueTask interface"
```

---

## Task 2: Update orchestration.yml with Complete Skill Lists

**Files:**
- Modify: `config/orchestration.yml`

**Step 1: Add skills to pichu (orchestrator)**

Add `agent_config` to pichu bot (lines 1-13):

```yaml
bots:
  # Primary orchestrator bot
  - name: pichu
    token: ${PICHU_BOT_TOKEN}
    username: pichu_cc_bot
    role: orchestrator
    tmux:
      session: cc-orchestrator
      window: 0
      pane: 0
    agent_config:
      skills: [telegram-agent, comm-brainstorm, task-orchestration]
      memory: state/memory/orchestrator.md
    permissions:
      allowed_chats: [195061634]
      admin_users: [195061634]
```

**Step 2: Update backend (pikachu) skills**

Ensure pikachu has `plan-execute` in skills (line 25):

```yaml
    agent_config:
      skills: [telegram-agent, dev-test, review-code, plan-execute]
      memory: state/memory/backend.md
```

**Step 3: Verify YAML is valid**

Run: `node -e "require('js-yaml').load(require('fs').readFileSync('config/orchestration.yml', 'utf8')); console.log('YAML valid')"`
Expected: `YAML valid`

**Step 4: Commit**

```bash
git add config/orchestration.yml
git commit -m "feat(config): add complete skill lists to all bots"
```

---

## Task 3: Modify spawn-agent.ts to Read Skills from Config

**Files:**
- Modify: `lib/spawn-agent.ts:35-97`

**Step 1: Read skills from bot config**

Modify the `spawnAgent` function to read skills from config. After line 68 (where botConfig is retrieved), add skill reading:

```typescript
export function spawnAgent(options: SpawnOptions): SpawnResult {
  const {
    name,
    persona,
    skills: optionsSkills,  // Rename to avoid conflict
    memoryFile,
    isAdhoc = false,
    model = 'sonnet',
    style = 'professional'
  } = options;

  // ... existing session creation code ...

  // Build initial prompt with telegram-agent identity
  let initialPrompt = '';
  const botConfig = getBotByRole(name);

  // Read skills from config (preferred) or options (fallback)
  const configSkills = botConfig?.agent_config?.skills || [];
  const skills = optionsSkills && optionsSkills.length > 0 ? optionsSkills : configSkills;

  if (botConfig) {
    initialPrompt = `"/telegram-agent --name ${botConfig.name} --who \\"${persona || botConfig.role}\\""`;
  }
```

**Step 2: Update skills injection to use combined skills**

Modify the skills loading section (lines 90-94):

```typescript
  // Load skills from config
  for (const skill of skills) {
    execSync(`tmux send-keys -t ${sessionName} '/${skill}' Enter`);
    execSync('sleep 1');
  }
```

Note: Changed from `/skill ${skill}` to `/${skill}` to match skill invocation pattern.

**Step 3: Test spawn with config skills**

Run: `npx tsx bin/cc-orch.ts spawn backend 2>&1 | head -5`
Expected: Session created message (may say "already_exists" if backend is running)

**Step 4: Commit**

```bash
git add lib/spawn-agent.ts
git commit -m "feat(spawn): read skills from config, inject on agent spawn"
```

---

## Task 4: Update Orchestrator to Pass chatId in Task Submission

**Files:**
- Modify: `lib/orchestrator.ts`
- Modify: `bin/cc-orch.ts` (submit command)

**Step 1: Add chatId to submitTask function**

Find the task submission logic and add chatId parameter. In `lib/orchestrator.ts`, modify the task object to include chatId:

```typescript
// When creating task for queue
const taskEntry = {
  id: taskId,
  planPath,
  workflow,
  chatId: options.chatId,  // Add this line
  enqueued_at: new Date().toISOString()
};
```

**Step 2: Update CLI submit command to accept chatId**

In `bin/cc-orch.ts`, add `--chat-id` option to submit command:

```typescript
program.command('submit <taskId>')
  .description('Submit a task to the orchestrator')
  .option('-p, --plan <path>', 'Path to plan file')
  .option('-w, --workflow <name>', 'Workflow to use', 'default')
  .option('-c, --chat-id <id>', 'Telegram chat ID for notifications', parseInt)
  .action((taskId, options) => {
    const result = submitTask(taskId, {
      planPath: options.plan,
      workflow: options.workflow,
      chatId: options.chatId
    });
    // ...
  });
```

**Step 3: Verify CLI help shows new option**

Run: `npx tsx bin/cc-orch.ts submit --help`
Expected: Shows `-c, --chat-id <id>` option

**Step 4: Commit**

```bash
git add lib/orchestrator.ts bin/cc-orch.ts
git commit -m "feat(orchestrator): pass chatId through task submission"
```

---

## Task 5: Add Notification Protocol to plan-execute Skill

**Files:**
- Modify: `.claude/skills/plan-execute/SKILL.md`

**Step 1: Add notification section to SKILL.md**

Add after the "Flags" section:

```markdown
## Notification Protocol

When executing a task with `chat_id` in context, send Telegram notifications at lifecycle events:

### Events

| Event | When | Format |
|-------|------|--------|
| START | Task begins | `▶ Starting {taskId}...` |
| PROGRESS | Batch complete | `✓ Batch {n}/{total}: {summary}` |
| BLOCKED | Cannot proceed | `⚠ BLOCKED: {reason}` |
| COMPLETE | All done | `✅ {taskId} complete!` |

### How to Notify

Use `/telegram-reply` with task's chat_id:

```bash
/telegram-reply --chat-id {chatId} --text "▶ Starting TASK-001..."
```

### In Auto Mode

- Send START notification when plan execution begins
- Send PROGRESS after each batch
- Send COMPLETE when all tasks done
- Send BLOCKED if stopping due to unresolvable issue
```

**Step 2: Update auto mode flow to include notifications**

Modify the "Auto mode" flow diagram to show notifications:

```markdown
**Auto mode (with notifications):**
```
Load plan
    ↓
/telegram-reply --chat-id {chatId} "▶ Starting..."
    ↓
Execute batch 1
    ↓
/telegram-reply --chat-id {chatId} "✓ Batch 1/N: ..."
    ↓
[Auto-continue]
    ↓
... repeat ...
    ↓
/telegram-reply --chat-id {chatId} "✅ TASK-XXX complete!"
```
```

**Step 3: Verify skill file is valid markdown**

Run: `node -e "console.log(require('fs').readFileSync('.claude/skills/plan-execute/SKILL.md', 'utf8').length)" `
Expected: A number (file exists and is readable)

**Step 4: Commit**

```bash
git add .claude/skills/plan-execute/SKILL.md
git commit -m "feat(skill): add notification protocol to plan-execute"
```

---

## Task 6: Integration Test

**Files:**
- Test: Full pipeline test

**Step 1: Kill existing backend agent for clean test**

Run: `npx tsx bin/cc-orch.ts kill backend`
Expected: Session killed (or error if not running)

**Step 2: Spawn fresh backend agent with skills from config**

Run: `npx tsx bin/cc-orch.ts spawn backend`
Expected: Agent spawned with skills loaded

**Step 3: Check backend has telegram-agent identity**

Run: `tmux capture-pane -t cc-backend -p | head -20`
Expected: Shows telegram-agent identity confirmation

**Step 4: Submit test task with chatId**

Run: `npx tsx bin/cc-orch.ts submit TEST-005 -p docs/plans/2026-03-02-test-plan.md -c 195061634`
Expected: Task submitted with position 1

**Step 5: Verify task has chatId**

Run: `cat state/pending/backend.json | grep -A5 TEST-005`
Expected: Shows task with chatId field

**Step 6: Commit test verification**

```bash
git add state/pending/backend.json
git commit -m "test: verify chatId flows through task submission"
```

---

---

## Task 7: Create Commander Skill for Pichu

**Files:**
- Create: `.claude/skills/commander/SKILL.md`

**Step 1: Create commander skill directory**

Run: `mkdir -p .claude/skills/commander`

**Step 2: Create SKILL.md with commander protocol**

```markdown
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
- Guide user through brainstorm → design → plan → execute

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
```

**Step 3: Update orchestration.yml to use commander skill**

Change pichu's skills from `task-orchestration` to `commander`:

```yaml
agent_config:
  skills: [telegram-agent, comm-brainstorm, commander]
```

**Step 4: Verify skill file exists**

Run: `cat .claude/skills/commander/SKILL.md | head -10`
Expected: Shows skill header

**Step 5: Commit**

```bash
git add .claude/skills/commander/SKILL.md config/orchestration.yml
git commit -m "feat(skill): add commander skill for pichu orchestrator"
```

---

## Verification Checklist

- [ ] QueueTask interface has `chatId` field
- [ ] All bots in orchestration.yml have `agent_config.skills`
- [ ] spawn-agent.ts reads skills from config
- [ ] Orchestrator passes `chatId` in task submission
- [ ] plan-execute skill documents notification protocol
- [ ] Integration test passes

---

## Files Modified Summary

| File | Changes |
|------|---------|
| `lib/queue-manager.ts` | Add `chatId?: number` to QueueTask |
| `config/orchestration.yml` | Add complete skill lists to all bots |
| `lib/spawn-agent.ts` | Read skills from config, inject on spawn |
| `lib/orchestrator.ts` | Pass chatId in task submission |
| `bin/cc-orch.ts` | Add --chat-id option to submit |
| `.claude/skills/plan-execute/SKILL.md` | Add notification protocol |
