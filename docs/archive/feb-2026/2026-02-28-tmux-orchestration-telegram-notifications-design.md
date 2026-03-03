# Tmux Orchestration & Telegram Notifications Design

> **For Claude:** REQUIRED SUB-SKILL: Use `writing-plans` skill to create implementation plan from this design.

**Goal:** Enhance dev-workspace workflow with automatic tmux window allocation and rich Telegram progress notifications during plan execution.

**Architecture:** New `tmux-orchestrator` skill detects available Claude tmux windows via pane text analysis, injects commands for session setup, and hands off to `executing-plans`. Enhanced `executing-plans` sends progress notifications to Telegram at task boundaries using the existing telegram-reply infrastructure.

**Tech Stack:** Node.js, tmux (send-keys, capture-pane), HTTP fetch to gateway, existing bots.yml config

---

## Overview

### Problem

When choosing "Parallel Session (separate)" in writing-plans:
1. User must manually open new terminal/tmux and run commands
2. No visibility into progress until session completes
3. No automatic context setup for the new session

### Solution

1. **tmux-orchestrator skill** - Automatically detect and allocate idle tmux windows
2. **Telegram notifications** - Send progress updates to admin chat during execution
3. **Integrated handoff** - writing-plans invokes orchestrator seamlessly

---

## Components

### 1. tmux-orchestrator (New Skill)

**Location:** `.claude/skills/tmux-orchestrator/`

**Purpose:** Detect available Claude tmux windows and inject execution commands.

#### Core Functions

| Function | Description |
|----------|-------------|
| `detectContext()` | Get current tmux session, window, pane info |
| `getPrimaryBot()` | Read bots.yml, return primary bot name |
| `listClaudeWindows()` | List all tmux windows matching `cc-*` pattern |
| `capturePaneText(window)` | Get visible text from tmux pane |
| `checkAvailability(window)` | Analyze pane text for streaming/prompt patterns |
| `allocateWindow()` | Find available window or return `NO_WINDOW` |
| `injectIntoSession(window, commands[])` | Send keystrokes via `tmux send-keys` |
| `derivePersona(task)` | Extract `--who` from task context (labels, keywords) |

#### Availability Detection Logic

```
capture pane text →
  check for streaming indicators ("Thinking", "Working", incomplete lines) → WORKING
  check for prompt patterns (ends with ">", "You:", waiting input) → IDLE
  else → AMBIGUOUS (treat as working to be safe)
```

#### Injection Sequence

When allocating an idle window:

```
1. /clear                       # Clear context
2. Wait 5s for completion
3. /telegram-agent \            # Re-establish identity
     --name {bot} \
     --who "{derived_persona}" \
     --response-style {style}
4. Wait for identity setup
5. /executing-plans --plan {plan_path}
```

#### Persona Derivation Logic

```javascript
function derivePersona(task) {
  const keywords = [...task.labels, ...extractKeywords(task.description)];

  if (keywords.includes('backend') || keywords.includes('api')) {
    return 'backend developer';
  }
  if (keywords.includes('frontend') || keywords.includes('ui')) {
    return 'frontend developer';
  }
  if (keywords.includes('docs') || keywords.includes('documentation')) {
    return 'technical writer';
  }
  if (keywords.includes('test') || keywords.includes('testing')) {
    return 'QA engineer';
  }
  if (keywords.includes('devops') || keywords.includes('infra')) {
    return 'DevOps engineer';
  }
  return 'software developer';
}
```

#### Fallback Behavior

If no windows available:
1. Print stdout instructions: "No tmux windows available. Run in new terminal: `claude /executing-plans --plan ...`"
2. Return structured result with `status: NO_WINDOW`

---

### 2. executing-plans (Enhanced)

**Location:** `.claude/skills/executing-plans/`

**Purpose:** Add Telegram notification hooks at task boundaries.

#### Notification Hooks

| Hook Point | Trigger | Message Format |
|------------|---------|----------------|
| `onPlanStart` | Plan loaded, before first task | "📋 Starting: **{plan_name}**\n\nTasks: {task_list_summary}\n\nBot: {bot_name}" |
| `onTaskStart` | Task marked in_progress | "▶️ Task {n}/{total}: **{task_name}**" |
| `onTaskComplete` | Task marked completed | "✅ Task {n}/{total}: **{task_name}**\n\n{result_summary}" |
| `onPlanComplete` | All tasks done | "🎉 Completed: **{plan_name}**\n\n{final_summary}" |

#### Notification Implementation

Use HTTP call to gateway (same as telegram-reply skill):

```javascript
async function sendNotification(message: string) {
  const botName = process.env.TG_BOT_NAME;
  const botConfig = loadBotsConfig().bots.find(b => b.name === botName);
  const adminChatId = botConfig?.admin_chat_id;

  if (!botName || !adminChatId) {
    console.log('[Notify] No TG_BOT_NAME or admin_chat_id, skipping notification');
    return;
  }

  await fetch('http://localhost:3100/reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bot_id: botName,
      chat_id: adminChatId,
      text: message,
      parse_mode: 'MarkdownV2',
    }),
  });
}
```

#### Result Summary Extraction

For `onTaskComplete`:

```javascript
function extractResultSummary(): string {
  const changedFiles = execSync('git diff --name-only HEAD~1').toString().trim();
  const fileCount = changedFiles.split('\n').filter(Boolean).length;
  const commitHash = execSync('git rev-parse --short HEAD').toString().trim();

  return `Files changed: ${fileCount}\nCommit: ${commitHash}`;
}
```

#### Updated Skill Flow

```
Load plan
    ↓
onPlanStart → send notification
    ↓
For each task:
    ├── onTaskStart → send notification
    ├── Execute task steps
    ├── onTaskComplete → send notification
    ↓
onPlanComplete → send notification
    ↓
Continue to verification-before-completion
```

---

### 3. writing-plans (Enhanced)

**Location:** `.claude/skills/writing-plans/`

**Purpose:** Integrate tmux-orchestrator for "Parallel Session" option.

#### Updated Execution Handoff

After saving the plan:

```
**"Plan complete and saved to `docs/plans/<filename>.md`. Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (tmux)** - Find available tmux window, inject commands, get Telegram updates

**Which approach?"**
```

#### If Parallel Session (tmux) Chosen

```
1. Invoke tmux-orchestrator with plan context:
   - Plan path
   - Task metadata (for persona derivation)
   - Bot name from TG_BOT_NAME

2. tmux-orchestrator:
   a. Detect current tmux context
   b. List cc-* windows, check availability
   c. If idle window found:
      - Inject: /clear
      - Wait 5s
      - Inject: /telegram-agent --name {bot} --who "{persona}"
      - Inject: /executing-plans --plan {plan_path}
   d. If no idle window:
      - Print stdout instructions
      - Return status: NO_WINDOW

3. Report result:
   - "Injected into cc-pikachu. You'll receive Telegram updates as tasks progress."
   - OR "No available tmux windows. Run manually: ..."
```

---

## Data Flow

```
User requests feature
        ↓
/brainstorming → design doc
        ↓
/writing-plans → implementation plan
        ↓
User chooses "Parallel Session (tmux)"
        ↓
tmux-orchestrator:
  ├── Get primary bot from bots.yml
  ├── List cc-* windows
  ├── Capture pane text for each
  ├── Find idle window (no streaming, has prompt)
  ├── /clear → wait 5s
  ├── /telegram-agent --name {bot} --who "{persona}"
  └── /executing-plans --plan {path}
        ↓
executing-plans runs in tmux:
  ├── onPlanStart → Telegram: "📋 Starting: Feature X..."
  ├── Task 1:
  │     ├── onTaskStart → "▶️ Task 1/5: Setup..."
  │     ├── Execute steps
  │     └── onTaskComplete → "✅ Task 1/5: Setup - 3 files"
  ├── Task 2...N: (same pattern)
  └── onPlanComplete → "🎉 Completed: Feature X"
        ↓
User sees progress in Telegram admin chat
```

---

## File Changes

### Files to Create

| File | Purpose |
|------|---------|
| `.claude/skills/tmux-orchestrator/SKILL.md` | Skill definition and usage |
| `.claude/skills/tmux-orchestrator/lib/detect.js` | Tmux detection functions |
| `.claude/skills/tmux-orchestrator/lib/inject.js` | Tmux injection functions |
| `.claude/skills/tmux-orchestrator/lib/persona.js` | Persona derivation logic |

### Files to Modify

| File | Changes |
|------|---------|
| `.claude/skills/executing-plans/SKILL.md` | Add notification hooks documentation |
| `.claude/skills/writing-plans/SKILL.md` | Update handoff section for tmux integration |

### Backup Before Implementation

```bash
# Create backups of existing skills
cp -r .claude/skills/executing-plans .claude/skills/executing-plans.backup
cp -r .claude/skills/writing-plans .claude/skills/writing-plans.backup
```

---

## Dependencies

- **tmux** - For window management and keystroke injection
- **bots.yml** - Primary bot and admin_chat_id configuration
- **Gateway running** - localhost:3100 for /reply endpoint
- **TG_BOT_NAME env var** - Set by start-telegram-agent.sh or manually

---

## Testing Strategy

1. **Unit tests** for persona derivation logic
2. **Manual test** for tmux detection (capture pane, analyze text)
3. **Manual test** for injection sequence (clear → agent → executing-plans)
4. **Integration test** for full flow with a simple plan
5. **Notification test** verify Telegram messages arrive in admin chat
