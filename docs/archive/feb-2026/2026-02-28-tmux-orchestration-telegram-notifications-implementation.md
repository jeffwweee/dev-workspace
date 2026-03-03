# Tmux Orchestration & Telegram Notifications Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `executing-plans` or `subagent-driven-development` skill to implement this plan task-by-task.

**Goal:** Enhance dev-workspace workflow with automatic tmux window allocation and rich Telegram progress notifications during plan execution.

**Architecture:** New `tmux-orchestrator` skill detects available Claude tmux windows via pane text analysis, injects commands for session setup, and hands off to `executing-plans`. Enhanced `executing-plans` sends progress notifications to Telegram at task boundaries using the existing telegram-reply infrastructure.

**Tech Stack:** Node.js, tmux (send-keys, capture-pane), HTTP fetch to gateway, YAML config parsing

---

## Prerequisites

Before starting, backup existing skills:

```bash
cd /Users/jeffwweee/jef/dev-workspace
cp -r .claude/skills/executing-plans .claude/skills/executing-plans.backup
cp -r .claude/skills/writing-plans .claude/skills/writing-plans.backup
```

---

## Task 1: Create tmux-orchestrator Skill Directory Structure

**Files:**
- Create: `.claude/skills/tmux-orchestrator/SKILL.md`
- Create: `.claude/skills/tmux-orchestrator/lib/detect.cjs`
- Create: `.claude/skills/tmux-orchestrator/lib/inject.cjs`
- Create: `.claude/skills/tmux-orchestrator/lib/persona.cjs`
- Create: `.claude/skills/tmux-orchestrator/lib/notify.cjs`

**Step 1: Create skill directory**

```bash
mkdir -p /Users/jeffwweee/jef/dev-workspace/.claude/skills/tmux-orchestrator/lib
```

**Step 2: Create SKILL.md**

Create file `.claude/skills/tmux-orchestrator/SKILL.md`:

```markdown
---
name: tmux-orchestrator
description: "Detects available tmux windows and spawns Claude Code sessions. Use when you need to start a parallel Claude session in an available tmux window."
---

# tmux-orchestrator

## Overview

Detects available Claude tmux windows by analyzing pane content, allocates an idle window, clears context, sets up telegram-agent identity, and hands off to executing-plans.

## Usage

```bash
/tmux-orchestrator --plan docs/plans/2026-02-28-feature.md
```

## Arguments

| Argument | Description | Required |
|----------|-------------|----------|
| `--plan` | Path to implementation plan | Yes |
| `--bot` | Bot name (default: from TG_BOT_NAME env or primary in bots.yml) | No |
| `--style` | Response style for telegram-agent (default: professional) | No |

## Process

1. **Detect context** - Get current tmux session/window
2. **List windows** - Find all `cc-*` windows
3. **Check availability** - Capture pane text, detect idle vs working
4. **Derive persona** - Extract --who from plan task context
5. **Inject commands**:
   - `/clear` (wait 5s)
   - `/telegram-agent --name {bot} --who "{persona}" --response-style {style}`
   - `/executing-plans --plan {path}`

## Availability Detection

```
pane text contains streaming indicators ("Thinking", "Working", "...") → WORKING
pane text ends with prompt (">", "You:", waiting) → IDLE
else → AMBIGUOUS (treat as working)
```

## Output

On success:
```
✓ Injected into cc-pikachu
  Plan: feature-x
  Persona: backend developer

You'll receive Telegram updates as tasks progress.
```

On no window:
```
✗ No available tmux windows

To execute manually:
  1. Open a new terminal
  2. Run: claude
  3. Type: /executing-plans --plan docs/plans/feature.md
```

## Dependencies

- tmux running with `cc-*` sessions
- Gateway running at localhost:3100
- bots.yml with primary bot configured
```

**Step 3: Commit**

```bash
cd /Users/jeffwweee/jef/dev-workspace
git add .claude/skills/tmux-orchestrator/SKILL.md
git commit -m "feat(skills): add tmux-orchestrator skill definition"
```

---

## Task 2: Implement Persona Derivation Module

**Files:**
- Create: `.claude/skills/tmux-orchestrator/lib/persona.cjs`

**Step 1: Create persona.cjs**

Create file `.claude/skills/tmux-orchestrator/lib/persona.cjs`:

```javascript
/**
 * Persona derivation from task context
 * Extracts --who value from plan task metadata
 */

/**
 * Extract keywords from text
 * @param {string} text - Text to extract keywords from
 * @returns {string[]} - Array of lowercase keywords
 */
function extractKeywords(text) {
  if (!text) return [];

  const keywordPatterns = [
    /\b(backend|api|server|database|db|sql|nosql)\b/gi,
    /\b(frontend|ui|ux|css|react|vue|angular)\b/gi,
    /\b(docs|documentation|readme|guide)\b/gi,
    /\b(test|testing|spec|qa|cypress|jest)\b/gi,
    /\b(devops|infra|infrastructure|ci|cd|docker|k8s)\b/gi,
    /\b(security|auth|authentication|oauth)\b/gi,
    /\b(cli|command|script|bash)\b/gi,
  ];

  const keywords = new Set();
  for (const pattern of keywordPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(m => keywords.add(m.toLowerCase()));
    }
  }

  return Array.from(keywords);
}

/**
 * Derive persona from task context
 * @param {object} task - Task object with labels and description
 * @returns {string} - Persona string for --who argument
 */
function derivePersona(task) {
  if (!task) return 'software developer';

  const labels = task.labels || [];
  const description = task.description || '';
  const keywords = [...labels, ...extractKeywords(description)];

  // Check for specific domain keywords
  if (keywords.some(k => ['backend', 'api', 'server', 'database', 'db', 'sql'].includes(k))) {
    // Try to detect language
    if (keywords.some(k => ['python', 'django', 'fastapi'].includes(k))) {
      return 'backend Python developer';
    }
    if (keywords.some(k => ['node', 'nodejs', 'express', 'typescript'].includes(k))) {
      return 'backend Node.js developer';
    }
    if (keywords.some(k => ['go', 'golang'].includes(k))) {
      return 'backend Go developer';
    }
    return 'backend developer';
  }

  if (keywords.some(k => ['frontend', 'ui', 'ux', 'css', 'react', 'vue', 'angular'].includes(k))) {
    return 'frontend developer';
  }

  if (keywords.some(k => ['docs', 'documentation', 'readme', 'guide'].includes(k))) {
    return 'technical writer';
  }

  if (keywords.some(k => ['test', 'testing', 'spec', 'qa', 'cypress', 'jest'].includes(k))) {
    return 'QA engineer';
  }

  if (keywords.some(k => ['devops', 'infra', 'infrastructure', 'ci', 'cd', 'docker', 'k8s'].includes(k))) {
    return 'DevOps engineer';
  }

  if (keywords.some(k => ['security', 'auth', 'authentication', 'oauth'].includes(k))) {
    return 'security engineer';
  }

  if (keywords.some(k => ['cli', 'command', 'script', 'bash'].includes(k))) {
    return 'CLI developer';
  }

  return 'software developer';
}

/**
 * Extract task context from plan content
 * @param {string} planContent - Full plan file content
 * @returns {object} - Task metadata for persona derivation
 */
function extractTaskContext(planContent) {
  if (!planContent) return null;

  const task = {
    labels: [],
    description: '',
  };

  // Extract plan title/goal
  const goalMatch = planContent.match(/\*\*Goal:\*\*\s*(.+)/);
  if (goalMatch) {
    task.description = goalMatch[1];
  }

  // Extract task names for keyword extraction
  const taskMatches = planContent.matchAll(/### Task \d+:\s*(.+)/g);
  for (const match of taskMatches) {
    task.description += ' ' + match[1];
  }

  // Look for common labels in plan header
  if (planContent.includes('backend') || planContent.includes('API')) {
    task.labels.push('backend');
  }
  if (planContent.includes('frontend') || planContent.includes('UI')) {
    task.labels.push('frontend');
  }
  if (planContent.includes('test') || planContent.includes('TDD')) {
    task.labels.push('test');
  }

  return task;
}

module.exports = {
  derivePersona,
  extractKeywords,
  extractTaskContext,
};
```

**Step 2: Verify the module**

```bash
cd /Users/jeffwweee/jef/dev-workspace
node -e "
const { derivePersona, extractKeywords } = require('./.claude/skills/tmux-orchestrator/lib/persona.cjs');

// Test cases
console.log('Test 1 (backend):', derivePersona({ labels: ['backend'], description: 'Add API endpoint' }));
console.log('Test 2 (frontend):', derivePersona({ labels: ['frontend'], description: 'Fix UI bug' }));
console.log('Test 3 (docs):', derivePersona({ labels: ['docs'], description: 'Update README' }));
console.log('Test 4 (default):', derivePersona({ labels: [], description: 'Some feature' }));
"
```

Expected output:
```
Test 1 (backend): backend developer
Test 2 (frontend): frontend developer
Test 3 (docs): technical writer
Test 4 (default): software developer
```

**Step 3: Commit**

```bash
git add .claude/skills/tmux-orchestrator/lib/persona.cjs
git commit -m "feat(tmux-orchestrator): add persona derivation module"
```

---

## Task 3: Implement Tmux Detection Module

**Files:**
- Create: `.claude/skills/tmux-orchestrator/lib/detect.cjs`

**Step 1: Create detect.cjs**

Create file `.claude/skills/tmux-orchestrator/lib/detect.cjs`:

```javascript
/**
 * Tmux detection functions
 * List windows, capture pane text, check availability
 */

const { execSync } = require('child_process');

/**
 * Check if running inside tmux
 * @returns {boolean}
 */
function isInTmux() {
  return !!process.env.TMUX;
}

/**
 * Get current tmux context (session, window, pane)
 * @returns {object|null}
 */
function getCurrentContext() {
  if (!isInTmux()) return null;

  try {
    const session = execSync('tmux display-message -p "#{session_name}"', { encoding: 'utf-8' }).trim();
    const window = execSync('tmux display-message -p "#{window_index}"', { encoding: 'utf-8' }).trim();
    const pane = execSync('tmux display-message -p "#{pane_index}"', { encoding: 'utf-8' }).trim();

    return { session, window: parseInt(window), pane: parseInt(pane) };
  } catch {
    return null;
  }
}

/**
 * List all tmux sessions
 * @returns {string[]}
 */
function listSessions() {
  try {
    const output = execSync('tmux list-sessions -F "#{session_name}" 2>/dev/null', { encoding: 'utf-8' });
    return output.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * List all Claude-related windows (cc-* pattern)
 * @returns {Array<{session: string, window: number, name: string}>}
 */
function listClaudeWindows() {
  const windows = [];

  try {
    const output = execSync('tmux list-windows -a -F "#{session_name}:#{window_index}:#{window_name}" 2>/dev/null', { encoding: 'utf-8' });
    const lines = output.trim().split('\n').filter(Boolean);

    for (const line of lines) {
      const [session, windowStr, name] = line.split(':');
      // Match cc-alpha, cc-beta, cc-pichu, cc-pikachu, etc.
      if (name && name.startsWith('cc-')) {
        windows.push({
          session,
          window: parseInt(windowStr),
          name,
          target: `${session}:${windowStr}.0`, // Default to pane 0
        });
      }
    }
  } catch {
    // Ignore errors
  }

  return windows;
}

/**
 * Capture visible text from a tmux pane
 * @param {string} target - Tmux target (e.g., "cc-alpha:0.0")
 * @returns {string}
 */
function capturePaneText(target) {
  try {
    const output = execSync(`tmux capture-pane -t ${target} -p 2>/dev/null`, { encoding: 'utf-8' });
    return output;
  } catch {
    return '';
  }
}

/**
 * Check if a Claude window is idle (available for work)
 * @param {string} target - Tmux target
 * @returns {{available: boolean, status: string, reason: string}}
 */
function checkAvailability(target) {
  const text = capturePaneText(target);

  if (!text) {
    return { available: false, status: 'UNKNOWN', reason: 'Could not capture pane text' };
  }

  const lastLines = text.trim().split('\n').slice(-10).join('\n').toLowerCase();

  // Streaming indicators - Claude is working
  const streamingPatterns = [
    /thinking\.\.\./,
    /working\.\.\./,
    /\.\.\.$/,  // Ends with "..." (streaming)
    /\bsearching\b/,
    /\banalyzing\b/,
    /\bprocessing\b/,
    /━+$/,  // Progress bars
  ];

  for (const pattern of streamingPatterns) {
    if (pattern.test(lastLines)) {
      return { available: false, status: 'WORKING', reason: 'Detected streaming activity' };
    }
  }

  // Prompt patterns - Claude is idle/waiting
  const promptPatterns = [
    />\s*$/,           // Ends with ">"
    /you:\s*$/i,       // Ends with "You:"
    /what would you/i, // Waiting for input
    /how can i help/i, // Ready prompt
    /╭─+╮/,           // Claude prompt box (new format)
  ];

  for (const pattern of promptPatterns) {
    if (pattern.test(lastLines)) {
      return { available: true, status: 'IDLE', reason: 'Detected idle prompt' };
    }
  }

  // Ambiguous - treat as working to be safe
  return { available: false, status: 'AMBIGUOUS', reason: 'Could not determine status' };
}

/**
 * Find an available Claude window
 * @param {string} excludeTarget - Target to exclude (current window)
 * @returns {object|null}
 */
function findAvailableWindow(excludeTarget = null) {
  const windows = listClaudeWindows();

  for (const win of windows) {
    if (excludeTarget && win.target === excludeTarget) {
      continue;
    }

    const availability = checkAvailability(win.target);
    if (availability.available) {
      return { ...win, ...availability };
    }
  }

  return null;
}

module.exports = {
  isInTmux,
  getCurrentContext,
  listSessions,
  listClaudeWindows,
  capturePaneText,
  checkAvailability,
  findAvailableWindow,
};
```

**Step 2: Verify the module**

```bash
cd /Users/jeffwweee/jef/dev-workspace
node -e "
const detect = require('./.claude/skills/tmux-orchestrator/lib/detect.cjs');

console.log('In tmux:', detect.isInTmux());
console.log('Current context:', detect.getCurrentContext());
console.log('Claude windows:', detect.listClaudeWindows());
"
```

Expected: Lists any `cc-*` tmux windows found.

**Step 3: Commit**

```bash
git add .claude/skills/tmux-orchestrator/lib/detect.cjs
git commit -m "feat(tmux-orchestrator): add tmux detection module"
```

---

## Task 4: Implement Tmux Injection Module

**Files:**
- Create: `.claude/skills/tmux-orchestrator/lib/inject.cjs`

**Step 1: Create inject.cjs**

Create file `.claude/skills/tmux-orchestrator/lib/inject.cjs`:

```javascript
/**
 * Tmux injection functions
 * Send keystrokes to tmux windows
 */

const { execSync } = require('child_process');

/**
 * Inject a command into a tmux pane
 * @param {string} target - Tmux target (e.g., "cc-alpha:0.0")
 * @param {string} command - Command to inject
 * @param {object} options - Options
 * @param {number} options.delayMs - Delay before sending Enter (default 300ms)
 */
function injectCommand(target, command, options = {}) {
  const delayMs = options.delayMs ?? 300;

  // Escape double quotes in command
  const escapedCommand = command.replace(/"/g, '\\"');

  try {
    // Send the command text (without Enter)
    execSync(`tmux send-keys -t ${target} "${escapedCommand}"`, { encoding: 'utf-8' });

    // Wait before sending Enter
    if (delayMs > 0) {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs);
    }

    // Send Enter key
    execSync(`tmux send-keys -t ${target} Enter`, { encoding: 'utf-8' });

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Inject multiple commands with delays between them
 * @param {string} target - Tmux target
 * @param {Array<{command: string, delayMs?: number}>} commands - Commands to inject
 */
async function injectCommands(target, commands) {
  const results = [];

  for (const { command, delayMs = 300 } of commands) {
    const result = injectCommand(target, command, { delayMs });
    results.push({ command, ...result });

    if (!result.success) {
      break;
    }

    // Additional wait after command is sent
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return results;
}

/**
 * Inject the full execution sequence into a tmux window
 * @param {string} target - Tmux target
 * @param {object} config - Configuration
 * @param {string} config.botName - Bot name for telegram-agent
 * @param {string} config.persona - Persona for --who
 * @param {string} config.style - Response style
 * @param {string} config.planPath - Path to plan file
 */
async function injectExecutionSequence(target, config) {
  const { botName, persona, style = 'professional', planPath } = config;

  const commands = [
    // Step 1: Clear context
    { command: '/clear', delayMs: 5000 },

    // Step 2: Set up telegram-agent identity
    {
      command: `/telegram-agent --name ${botName} --who "${persona}" --response-style ${style}`,
      delayMs: 3000,
    },

    // Step 3: Start executing the plan
    { command: `/executing-plans --plan ${planPath}`, delayMs: 0 },
  ];

  console.log(`Injecting execution sequence into ${target}...`);
  console.log(`  Bot: ${botName}`);
  console.log(`  Persona: ${persona}`);
  console.log(`  Plan: ${planPath}`);

  const results = await injectCommands(target, commands);

  const allSuccess = results.every(r => r.success);

  if (allSuccess) {
    console.log(`\n✓ Injected into ${target}`);
    console.log(`  You'll receive Telegram updates as tasks progress.`);
  } else {
    console.log(`\n✗ Injection failed:`);
    for (const r of results) {
      if (!r.success) {
        console.log(`  ${r.command}: ${r.error}`);
      }
    }
  }

  return { success: allSuccess, results };
}

module.exports = {
  injectCommand,
  injectCommands,
  injectExecutionSequence,
};
```

**Step 2: Commit**

```bash
git add .claude/skills/tmux-orchestrator/lib/inject.cjs
git commit -m "feat(tmux-orchestrator): add tmux injection module"
```

---

## Task 5: Implement Notification Module

**Files:**
- Create: `.claude/skills/tmux-orchestrator/lib/notify.cjs`

**Step 1: Create notify.cjs**

Create file `.claude/skills/tmux-orchestrator/lib/notify.cjs`:

```javascript
/**
 * Telegram notification functions
 * Send progress updates via gateway HTTP API
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

/**
 * Load bots configuration
 * @param {string} configPath - Path to bots.yml
 * @returns {object|null}
 */
function loadBotsConfig(configPath) {
  const defaultPath = process.env.CC_CONFIG_PATH || path.join(process.env.HOME, '.claude', 'bots.yml');

  try {
    const content = fs.readFileSync(configPath || defaultPath, 'utf-8');
    return yaml.load(content);
  } catch {
    return null;
  }
}

/**
 * Get bot configuration by name
 * @param {string} botName - Bot name
 * @param {string} configPath - Optional config path
 * @returns {object|null}
 */
function getBotConfig(botName, configPath) {
  const config = loadBotsConfig(configPath);
  if (!config || !config.bots) return null;

  return config.bots.find(b => b.name === botName);
}

/**
 * Get primary bot (first in list)
 * @param {string} configPath - Optional config path
 * @returns {object|null}
 */
function getPrimaryBot(configPath) {
  const config = loadBotsConfig(configPath);
  if (!config || !config.bots || config.bots.length === 0) return null;

  return config.bots[0];
}

/**
 * Escape text for MarkdownV2
 * @param {string} text - Text to escape
 * @returns {string}
 */
function escapeMarkdownV2(text) {
  if (!text) return '';
  // Escape backslash first
  let escaped = text.replace(/\\/g, '\\\\');
  // Then escape other special chars
  const specialChars = ['_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!'];
  for (const char of specialChars) {
    escaped = escaped.replace(new RegExp(`\\${char}`, 'g'), `\\${char}`);
  }
  return escaped;
}

/**
 * Send notification via gateway HTTP API
 * @param {object} options - Notification options
 * @param {string} options.botName - Bot name
 * @param {number} options.chatId - Chat ID to send to
 * @param {string} options.message - Message text (will be escaped for MarkdownV2)
 * @param {string} options.gatewayUrl - Gateway URL (default: http://localhost:3100)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function sendNotification(options) {
  const { botName, chatId, message, gatewayUrl = 'http://localhost:3100' } = options;

  if (!botName || !chatId) {
    return { success: false, error: 'Missing botName or chatId' };
  }

  try {
    const response = await fetch(`${gatewayUrl}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bot_id: botName,
        chat_id: chatId,
        text: escapeMarkdownV2(message),
        parse_mode: 'MarkdownV2',
      }),
    });

    const data = await response.json();

    if (data.ok) {
      return { success: true };
    } else {
      return { success: false, error: data.error || 'Unknown error' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Send plan start notification
 */
async function notifyPlanStart(botName, chatId, planName, taskCount) {
  const message = `📋 Starting: *${planName}*\n\nTasks: ${taskCount}\nBot: ${botName}`;
  return sendNotification({ botName, chatId, message });
}

/**
 * Send task start notification
 */
async function notifyTaskStart(botName, chatId, taskNum, totalTasks, taskName) {
  const message = `▶️ Task ${taskNum}/${totalTasks}: *${taskName}*`;
  return sendNotification({ botName, chatId, message });
}

/**
 * Send task complete notification
 */
async function notifyTaskComplete(botName, chatId, taskNum, totalTasks, taskName, resultSummary) {
  const message = `✅ Task ${taskNum}/${totalTasks}: *${taskName}*\n\n${resultSummary}`;
  return sendNotification({ botName, chatId, message });
}

/**
 * Send plan complete notification
 */
async function notifyPlanComplete(botName, chatId, planName, finalSummary) {
  const message = `🎉 Completed: *${planName}*\n\n${finalSummary}`;
  return sendNotification({ botName, chatId, message });
}

module.exports = {
  loadBotsConfig,
  getBotConfig,
  getPrimaryBot,
  escapeMarkdownV2,
  sendNotification,
  notifyPlanStart,
  notifyTaskStart,
  notifyTaskComplete,
  notifyPlanComplete,
};
```

**Step 2: Verify js-yaml is available**

```bash
cd /Users/jeffwweee/jef/dev-workspace
npm ls js-yaml 2>/dev/null || echo "js-yaml not installed, checking if needed..."
```

If not installed, the notify module will still work with a fallback.

**Step 3: Commit**

```bash
git add .claude/skills/tmux-orchestrator/lib/notify.cjs
git commit -m "feat(tmux-orchestrator): add telegram notification module"
```

---

## Task 6: Enhance executing-plans SKILL.md with Notification Hooks

**Files:**
- Modify: `.claude/skills/executing-plans/SKILL.md`

**Step 1: Add notification section to SKILL.md**

After the "Evolution Integration" section, add a new "Telegram Notifications" section:

```markdown
## Telegram Notifications

When executing a plan, send progress notifications to the admin chat via the gateway API.

### Prerequisites

- `TG_BOT_NAME` environment variable set
- Gateway running at localhost:3100
- Bot configured in bots.yml with admin_chat_id

### Notification Hooks

At each task boundary, send a notification:

**Plan Start** (before first task):
```
📋 Starting: **{plan_name}**

Tasks: {task_count}
Bot: {bot_name}
```

**Task Start** (when marking in_progress):
```
▶️ Task {n}/{total}: **{task_name}**
```

**Task Complete** (when marking completed):
```
✅ Task {n}/{total}: **{task_name}**

Files changed: {count}
Commit: {hash}
```

**Plan Complete** (all tasks done):
```
🎉 Completed: **{plan_name}**

{final_summary}
```

### Implementation

Use curl to call the gateway:

```bash
curl -s -X POST http://localhost:3100/reply \
  -H "Content-Type: application/json" \
  -d '{
    "bot_id": "'"$TG_BOT_NAME"'",
    "chat_id": <admin_chat_id>,
    "text": "<escaped_message>",
    "parse_mode": "MarkdownV2"
  }'
```

If `TG_BOT_NAME` is not set, skip notifications silently.
```

**Step 2: Commit**

```bash
git add .claude/skills/executing-plans/SKILL.md
git commit -m "docs(executing-plans): add telegram notification hooks documentation"
```

---

## Task 7: Update writing-plans SKILL.md for Tmux Handoff

**Files:**
- Modify: `.claude/skills/writing-plans/SKILL.md`

**Step 1: Update the "Execution Handoff" section**

Replace the existing handoff section (lines ~142-159) with:

```markdown
## Execution Handoff

After saving the plan, offer execution choice:

**"Plan complete and saved to `docs/plans/<filename>.md`. Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (tmux)** - Find available tmux window, inject commands, get Telegram updates

**Which approach?"**

**If Subagent-Driven chosen:**
- **REQUIRED SUB-SKILL:** Use `subagent-driven-development` skill
- Stay in this session
- Fresh subagent per task + code review

**If Parallel Session (tmux) chosen:**
- **REQUIRED SUB-SKILL:** Use `tmux-orchestrator` skill
- Detects available Claude tmux windows
- Injects: `/clear` → `/telegram-agent` → `/executing-plans`
- User receives Telegram notifications as tasks progress

### Tmux Handoff Flow

When user chooses "Parallel Session (tmux)":

1. Invoke `/tmux-orchestrator --plan docs/plans/<filename>.md`
2. Orchestrator will:
   - List all `cc-*` tmux windows
   - Capture pane text to check availability
   - Find an idle window (no streaming, has prompt)
   - Derive persona from plan content
   - Inject execution sequence
3. Report result to user:
   - On success: "Injected into cc-pikachu. You'll receive Telegram updates."
   - On no window: Print manual instructions
```

**Step 2: Commit**

```bash
git add .claude/skills/writing-plans/SKILL.md
git commit -m "docs(writing-plans): add tmux handoff integration"
```

---

## Task 8: Create Main Orchestrator Script

**Files:**
- Create: `.claude/skills/tmux-orchestrator/lib/index.cjs`

**Step 1: Create index.cjs (main entry point)**

Create file `.claude/skills/tmux-orchestrator/lib/index.cjs`:

```javascript
/**
 * tmux-orchestrator main entry point
 * Parses args, finds window, injects execution sequence
 */

const fs = require('fs');
const path = require('path');
const detect = require('./detect.cjs');
const inject = require('./inject.cjs');
const persona = require('./persona.cjs');
const notify = require('./notify.cjs');

/**
 * Parse command line arguments
 * @param {string[]} args - Process.argv slice
 * @returns {object}
 */
function parseArgs(args) {
  const result = {
    planPath: null,
    botName: process.env.TG_BOT_NAME,
    style: 'professional',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--plan' && args[i + 1]) {
      result.planPath = args[++i];
    } else if (arg === '--bot' && args[i + 1]) {
      result.botName = args[++i];
    } else if (arg === '--style' && args[i + 1]) {
      result.style = args[++i];
    }
  }

  return result;
}

/**
 * Print manual instructions when no window available
 */
function printManualInstructions(planPath) {
  console.log(`
✗ No available tmux windows detected.

To execute manually:

  1. Open a new terminal
  2. Run: claude
  3. Type: /executing-plans --plan ${planPath}

Or create a new tmux window and try again.
`);
}

/**
 * Main orchestrator function
 */
async function main(args) {
  const options = parseArgs(args);

  if (!options.planPath) {
    console.error('Error: --plan argument required');
    console.error('Usage: /tmux-orchestrator --plan docs/plans/plan.md [--bot name] [--style style]');
    process.exit(1);
  }

  console.log('tmux-orchestrator');
  console.log('=================\n');

  // Check if in tmux
  if (!detect.isInTmux()) {
    console.log('Not running in tmux. Opening in current terminal...\n');
    console.log(`Run: /executing-plans --plan ${options.planPath}`);
    return { success: true, method: 'direct' };
  }

  // Get current context to exclude from search
  const currentContext = detect.getCurrentContext();
  const excludeTarget = currentContext ? `${currentContext.session}:${currentContext.window}.0` : null;

  // Find available window
  console.log('Searching for available Claude windows...');
  const availableWindow = detect.findAvailableWindow(excludeTarget);

  if (!availableWindow) {
    printManualInstructions(options.planPath);
    return { success: false, method: 'none', reason: 'No available windows' };
  }

  console.log(`Found idle window: ${availableWindow.name} (${availableWindow.target})\n`);

  // Get bot name (fallback to primary)
  let botName = options.botName;
  if (!botName) {
    const primaryBot = notify.getPrimaryBot();
    botName = primaryBot?.name || 'unknown';
    console.log(`Using primary bot: ${botName}`);
  }

  // Read plan and derive persona
  let derivedPersona = 'software developer';
  try {
    const planContent = fs.readFileSync(options.planPath, 'utf-8');
    const taskContext = persona.extractTaskContext(planContent);
    derivedPersona = persona.derivePersona(taskContext);
    console.log(`Derived persona: ${derivedPersona}`);
  } catch (error) {
    console.log(`Could not read plan, using default persona: ${derivedPersona}`);
  }

  // Inject execution sequence
  const result = await inject.injectExecutionSequence(availableWindow.target, {
    botName,
    persona: derivedPersona,
    style: options.style,
    planPath: options.planPath,
  });

  return {
    success: result.success,
    method: 'injection',
    window: availableWindow.name,
    target: availableWindow.target,
  };
}

// Run if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  main(args).then(result => {
    process.exit(result.success ? 0 : 1);
  }).catch(error => {
    console.error('Error:', error.message);
    process.exit(1);
  });
}

module.exports = { main, parseArgs };
```

**Step 2: Test the orchestrator**

```bash
cd /Users/jeffwweee/jef/dev-workspace
node .claude/skills/tmux-orchestrator/lib/index.cjs --plan docs/plans/2026-02-28-tmux-orchestration-telegram-notifications-design.md
```

Expected: Either finds an available window and reports injection, or prints manual instructions.

**Step 3: Commit**

```bash
git add .claude/skills/tmux-orchestrator/lib/index.cjs
git commit -m "feat(tmux-orchestrator): add main orchestrator script"
```

---

## Task 9: Manual Integration Test

**Step 1: Verify all modules load**

```bash
cd /Users/jeffwweee/jef/dev-workspace

node -e "
const detect = require('./.claude/skills/tmux-orchestrator/lib/detect.cjs');
const inject = require('./.claude/skills/tmux-orchestrator/lib/inject.cjs');
const persona = require('./.claude/skills/tmux-orchestrator/lib/persona.cjs');
const notify = require('./.claude/skills/tmux-orchestrator/lib/notify.cjs');

console.log('✓ detect module loaded');
console.log('✓ inject module loaded');
console.log('✓ persona module loaded');
console.log('✓ notify module loaded');

console.log('\nPersona test:', persona.derivePersona({ labels: ['backend'], description: 'API work' }));
console.log('In tmux:', detect.isInTmux());
console.log('Claude windows:', detect.listClaudeWindows());
"
```

**Step 2: Test full orchestrator (dry run)**

```bash
cd /Users/jeffwweee/jef/dev-workspace
node .claude/skills/tmux-orchestrator/lib/index.cjs --plan docs/plans/2026-02-28-tmux-orchestration-telegram-notifications-design.md
```

**Step 3: Verify SKILL.md updates**

```bash
grep -A 5 "Parallel Session (tmux)" .claude/skills/writing-plans/SKILL.md
grep -A 5 "Telegram Notifications" .claude/skills/executing-plans/SKILL.md
```

**Step 4: Commit all verification**

```bash
git status
# If any uncommitted changes:
git add -A
git commit -m "test(tmux-orchestrator): verify integration"
```

---

## Task 10: Final Commit and Push

**Step 1: Review all changes**

```bash
cd /Users/jeffwweee/jef/dev-workspace
git log --oneline -10
git diff main --stat
```

**Step 2: Push to remote**

```bash
git push origin feature/tg-bots-v3
```

**Step 3: Cleanup backup (optional)**

After verifying everything works:

```bash
rm -rf .claude/skills/executing-plans.backup
rm -rf .claude/skills/writing-plans.backup
```

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Create tmux-orchestrator skill directory and SKILL.md |
| 2 | Implement persona derivation module |
| 3 | Implement tmux detection module |
| 4 | Implement tmux injection module |
| 5 | Implement notification module |
| 6 | Enhance executing-plans SKILL.md with notification docs |
| 7 | Update writing-plans SKILL.md for tmux handoff |
| 8 | Create main orchestrator script |
| 9 | Manual integration test |
| 10 | Final commit and push |
