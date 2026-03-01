# Phase 1: Foundation - Multi-Agent Orchestrator

> **For Claude:** REQUIRED SUB-SKILL: Use `executing-plans` or `subagent-driven-development` skill to implement this plan task-by-task.

**Goal:** Establish the foundational configuration, state management structure, and agent spawning utilities for the multi-agent orchestrator.

**Architecture:** File-based state management with YAML configuration. Agent spawning via tmux with CLAUDECODE workaround. Extended bots.yaml schema for role-based agent configuration.

**Tech Stack:** Node.js, tmux, YAML, file-based state

---

## Task 1.1: Create State Directory Structure

**Files:**
- Create: `state/agents/` (directory)
- Create: `state/work/` (directory)
- Create: `state/queues/` (directory)
- Create: `state/archive/` (directory)
- Create: `state/rss/` (directory)
- Create: `state/agents/.gitkeep`
- Create: `state/work/.gitkeep`
- Create: `state/queues/.gitkeep`

**Step 1: Create directory structure**

```bash
mkdir -p state/agents state/work state/queues state/archive state/rss
touch state/agents/.gitkeep state/work/.gitkeep state/queues/.gitkeep
```

**Step 2: Verify structure**

Run: `ls -la state/`
Expected: Directories agents, work, queues, archive, rss exist

**Step 3: Commit**

```bash
git add state/
git commit -m "feat(orchestrator): create state directory structure"
```

---

## Task 1.2: Create orchestration.yml Configuration

**Files:**
- Create: `config/orchestration.yml`

**Step 1: Write orchestration config**

```yaml
orchestration:
  loop_interval_ms: 30000
  telegram_poll_interval_ms: 5000
  plan_watch_enabled: true
  plan_watch_paths:
    - "docs/plans/*.md"
    - "registry/tasks/*.md"

limits:
  max_adhoc_per_type: 2
  max_total_adhoc: 5
  max_queue_length: 3

cleanup:
  adhoc_idle_timeout_ms: 1800000    # 30 minutes
  core_agent_clear_on_complete: true

archiving:
  max_file_size_kb: 50
  max_task_count: 50
  weekly_archive: true

workflows:
  default:
    pipeline: [backend, review-git, frontend, review-git, qa]
    review_threshold: 0.8
    max_retries: 3
    retry_backoff_base_ms: 30000

  backend_only:
    pipeline: [backend, review-git, qa]
    review_threshold: 0.85

  frontend_only:
    pipeline: [frontend, review-git, qa]
    review_threshold: 0.75
```

**Step 2: Verify file exists**

Run: `cat config/orchestration.yml`
Expected: YAML content displayed

**Step 3: Commit**

```bash
git add config/orchestration.yml
git commit -m "feat(orchestrator): add orchestration configuration"
```

---

## Task 1.3: Create Agent Spawning Library

**Files:**
- Create: `lib/spawn_agent.cjs`

**Step 1: Write spawn agent library**

```javascript
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Spawns a Claude Code agent in a tmux session
 * @param {Object} options - Agent configuration
 * @param {string} options.name - Agent name (e.g., 'backend', 'frontend')
 * @param {string} [options.persona] - Agent persona description
 * @param {string[]} [options.skills] - Skills to load
 * @param {string} [options.memoryFile] - Path to memory file
 * @param {boolean} [options.isAdhoc=false] - Whether this is an adhoc agent
 * @returns {{sessionName: string, status: string}}
 */
function spawnAgent(options) {
  const {
    name,
    persona,
    skills = [],
    memoryFile,
    isAdhoc = false
  } = options;

  const sessionName = isAdhoc ? `cc-adhoc-${name}` : `cc-${name}`;

  // Check if session already exists
  try {
    execSync(`tmux has-session -t ${sessionName} 2>/dev/null`);
    return { sessionName, status: 'already_exists' };
  } catch {
    // Session doesn't exist, create it
  }

  // Create tmux session
  try {
    execSync(`tmux new-session -d -s ${sessionName} -x 200 -y 50 2>/dev/null || true`);
  } catch (error) {
    console.error(`Failed to create tmux session ${sessionName}:`, error.message);
    return { sessionName, status: 'error', error: error.message };
  }

  // Start Claude with CLAUDECODE unset (workaround for nested sessions)
  const startCmd = 'env -u CLAUDECODE claude';
  execSync(`tmux send-keys -t ${sessionName} '${startCmd}' Enter`);

  // Wait for startup
  execSync('sleep 5');

  // Configure agent if persona provided
  if (persona) {
    const agentCmd = `/agent-setup --who "${persona}"`;
    if (memoryFile) {
      agentCmd + ` --memory ${memoryFile}`;
    }
    execSync(`tmux send-keys -t ${sessionName} '${agentCmd}' Enter`);
    execSync('sleep 2');
  }

  // Load skills
  if (skills.length > 0) {
    for (const skill of skills) {
      execSync(`tmux send-keys -t ${sessionName} '/skill ${skill}' Enter`);
      execSync('sleep 1');
    }
  }

  return { sessionName, status: 'spawned' };
}

/**
 * Kills an agent's tmux session
 * @param {string} name - Agent name
 * @param {boolean} [isAdhoc=false] - Whether this is an adhoc agent
 */
function killAgent(name, isAdhoc = false) {
  const sessionName = isAdhoc ? `cc-adhoc-${name}` : `cc-${name}`;

  try {
    execSync(`tmux kill-session -t ${sessionName} 2>/dev/null || true`);
    return { sessionName, status: 'killed' };
  } catch (error) {
    return { sessionName, status: 'error', error: error.message };
  }
}

/**
 * Checks if an agent session is running
 * @param {string} name - Agent name
 * @param {boolean} [isAdhoc=false] - Whether this is an adhoc agent
 * @returns {boolean}
 */
function isAgentRunning(name, isAdhoc = false) {
  const sessionName = isAdhoc ? `cc-adhoc-${name}` : `cc-${name}`;

  try {
    execSync(`tmux has-session -t ${sessionName} 2>/dev/null`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sends a command to an agent session
 * @param {string} name - Agent name
 * @param {string} command - Command to send
 * @param {boolean} [isAdhoc=false] - Whether this is an adhoc agent
 */
function sendToAgent(name, command, isAdhoc = false) {
  const sessionName = isAdhoc ? `cc-adhoc-${name}` : `cc-${name}`;
  execSync(`tmux send-keys -t ${sessionName} '${command}' Enter`);
}

/**
 * Lists all running agent sessions
 * @returns {string[]}
 */
function listAgentSessions() {
  try {
    const output = execSync('tmux list-sessions -F "#{session_name}" 2>/dev/null').toString();
    return output.trim().split('\n').filter(s => s.startsWith('cc-'));
  } catch {
    return [];
  }
}

module.exports = {
  spawnAgent,
  killAgent,
  isAgentRunning,
  sendToAgent,
  listAgentSessions
};
```

**Step 2: Create test file**

Create: `lib/__tests__/spawn_agent.test.js`

```javascript
const { spawnAgent, killAgent, isAgentRunning, listAgentSessions } = require('../spawn_agent.cjs');

// Note: These tests require tmux to be installed
// Run with: node lib/__tests__/spawn_agent.test.js

async function testSpawnAndKill() {
  console.log('Testing spawn_agent...');

  // Test spawn
  const result = spawnAgent({
    name: 'test-agent',
    persona: 'Test agent',
    isAdhoc: true
  });

  console.log('Spawn result:', result);
  console.assert(result.status === 'spawned' || result.status === 'already_exists', 'Agent should spawn');

  // Test is running
  const running = isAgentRunning('test-agent', true);
  console.log('Is running:', running);
  console.assert(running === true, 'Agent should be running');

  // Test list sessions
  const sessions = listAgentSessions();
  console.log('Sessions:', sessions);
  console.assert(sessions.includes('cc-adhoc-test-agent'), 'Session should be in list');

  // Test kill
  const killResult = killAgent('test-agent', true);
  console.log('Kill result:', killResult);

  // Verify killed
  const stillRunning = isAgentRunning('test-agent', true);
  console.assert(stillRunning === false, 'Agent should not be running after kill');

  console.log('All tests passed!');
}

testSpawnAndKill();
```

**Step 3: Run tests**

Run: `node lib/__tests__/spawn_agent.test.js`
Expected: "All tests passed!"

**Step 4: Commit**

```bash
git add lib/spawn_agent.cjs lib/__tests__/
git commit -m "feat(orchestrator): add agent spawning library with CLAUDECODE workaround"
```

---

## Task 1.4: Create Agent Memory File Templates

**Files:**
- Create: `state/agents/backend_MEMORY.md`
- Create: `state/agents/frontend_MEMORY.md`
- Create: `state/agents/qa_MEMORY.md`
- Create: `state/agents/review-git_MEMORY.md`
- Create: `state/PRIMARY_MEMORY.md`

**Step 1: Write PRIMARY_MEMORY.md template**

```markdown
# Primary Orchestrator Memory

## Essential Context
- Orchestrator manages core agents: backend, frontend, qa, review-git
- Each agent runs in dedicated tmux session
- CLAUDECODE workaround required for spawning: `env -u CLAUDECODE claude`

## Active Tasks
<!-- Format: TASK-XXX | Agent | Status | Started -->

## Recent Completions
<!-- Last 10 completed tasks -->

## Learnings
<!-- Patterns extracted from agent handoffs -->

## Metrics
- Tasks completed: 0
- Average task duration: N/A
- Review pass rate: N/A
```

**Step 2: Write agent memory templates**

`state/agents/backend_MEMORY.md`:
```markdown
# Backend Agent Memory

## Essential Context
- Focus: Backend/API development, database operations
- Languages: TypeScript, Node.js, Python
- Skills: backend-patterns, python-patterns

## Learned Patterns
<!-- What worked, what didn't -->

## Project Conventions
<!-- Discovered per-project conventions -->

## Recent Tasks
<!-- Last 5 completed tasks -->

## Error Resolutions
<!-- Successful error fixes -->
```

`state/agents/frontend_MEMORY.md`:
```markdown
# Frontend Agent Memory

## Essential Context
- Focus: Frontend/UI development, React, Vue, CSS
- Skills: frontend-patterns, ui-ux-pro-max

## Learned Patterns

## Project Conventions

## Recent Tasks

## Error Resolutions
```

`state/agents/qa_MEMORY.md`:
```markdown
# QA Agent Memory

## Essential Context
- Focus: Testing, verification, E2E tests
- Skills: tdd-workflow, e2e-testing

## Learned Patterns

## Test Strategies

## Recent Tasks

## Error Resolutions
```

`state/agents/review-git_MEMORY.md`:
```markdown
# Review-Git Agent Memory

## Essential Context
- Focus: Code review, security, git operations
- Outputs: confidence_score, commit_hash
- Skills: code-review, git-workflow, security-review

## Review Criteria
<!-- Quality standards enforced -->

## Common Issues Found
<!-- Patterns of issues detected -->

## Recent Reviews
<!-- Last 10 reviews with confidence scores -->

## Git Conventions
<!-- Commit message patterns, branch naming -->
```

**Step 3: Verify files**

Run: `ls -la state/agents/`
Expected: All memory files exist

**Step 4: Commit**

```bash
git add state/agents/ state/PRIMARY_MEMORY.md
git commit -m "feat(orchestrator): add agent memory file templates"
```

---

## Task 1.5: Create Queue File Templates

**Files:**
- Create: `state/queues/backend.queue.json`
- Create: `state/queues/frontend.queue.json`
- Create: `state/queues/qa.queue.json`
- Create: `state/queues/review-git.queue.json`

**Step 1: Write queue files**

Each queue file follows this format:

```json
{
  "agent": "backend",
  "max_length": 3,
  "tasks": []
}
```

Create all four queue files with appropriate agent names.

**Step 2: Write queue files**

```bash
cat > state/queues/backend.queue.json << 'EOF'
{
  "agent": "backend",
  "max_length": 3,
  "tasks": []
}
EOF

cat > state/queues/frontend.queue.json << 'EOF'
{
  "agent": "frontend",
  "max_length": 3,
  "tasks": []
}
EOF

cat > state/queues/qa.queue.json << 'EOF'
{
  "agent": "qa",
  "max_length": 3,
  "tasks": []
}
EOF

cat > state/queues/review-git.queue.json << 'EOF'
{
  "agent": "review-git",
  "max_length": 3,
  "tasks": []
}
EOF
```

**Step 3: Verify**

Run: `cat state/queues/backend.queue.json`
Expected: JSON content with empty tasks array

**Step 4: Commit**

```bash
git add state/queues/
git commit -m "feat(orchestrator): add agent queue files"
```

---

## Task 1.6: Create Queue Management Library

**Files:**
- Create: `lib/queue_manager.cjs`

**Step 1: Write queue manager**

```javascript
const fs = require('fs');
const path = require('path');

const QUEUES_DIR = path.join(__dirname, '..', 'state', 'queues');

/**
 * Reads an agent's queue
 * @param {string} agent - Agent name
 * @returns {Object} Queue object
 */
function readQueue(agent) {
  const queuePath = path.join(QUEUES_DIR, `${agent}.queue.json`);

  if (!fs.existsSync(queuePath)) {
    return { agent, max_length: 3, tasks: [] };
  }

  return JSON.parse(fs.readFileSync(queuePath, 'utf-8'));
}

/**
 * Writes an agent's queue
 * @param {string} agent - Agent name
 * @param {Object} queue - Queue object
 */
function writeQueue(agent, queue) {
  const queuePath = path.join(QUEUES_DIR, `${agent}.queue.json`);
  fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2));
}

/**
 * Adds a task to an agent's queue
 * @param {string} agent - Agent name
 * @param {Object} task - Task object
 * @returns {Object} Result with position and estimated wait
 */
function enqueueTask(agent, task) {
  const queue = readQueue(agent);

  if (queue.tasks.length >= queue.max_length) {
    return { success: false, reason: 'queue_full', max_length: queue.max_length };
  }

  const taskEntry = {
    ...task,
    enqueued_at: new Date().toISOString(),
    position: queue.tasks.length + 1
  };

  queue.tasks.push(taskEntry);
  writeQueue(agent, queue);

  return {
    success: true,
    position: taskEntry.position,
    estimated_wait_ms: taskEntry.position * 300000 // 5 min per task estimate
  };
}

/**
 * Removes and returns the next task from an agent's queue
 * @param {string} agent - Agent name
 * @returns {Object|null} Next task or null if empty
 */
function dequeueTask(agent) {
  const queue = readQueue(agent);

  if (queue.tasks.length === 0) {
    return null;
  }

  const task = queue.tasks.shift();
  writeQueue(agent, queue);

  return task;
}

/**
 * Peeks at the next task without removing it
 * @param {string} agent - Agent name
 * @returns {Object|null} Next task or null if empty
 */
function peekQueue(agent) {
  const queue = readQueue(agent);
  return queue.tasks.length > 0 ? queue.tasks[0] : null;
}

/**
 * Gets queue length
 * @param {string} agent - Agent name
 * @returns {number} Number of tasks in queue
 */
function getQueueLength(agent) {
  const queue = readQueue(agent);
  return queue.tasks.length;
}

/**
 * Checks if queue is at capacity
 * @param {string} agent - Agent name
 * @returns {boolean} True if queue is full
 */
function isQueueFull(agent) {
  const queue = readQueue(agent);
  return queue.tasks.length >= queue.max_length;
}

/**
 * Clears all tasks from an agent's queue
 * @param {string} agent - Agent name
 */
function clearQueue(agent) {
  writeQueue(agent, { agent, max_length: 3, tasks: [] });
}

module.exports = {
  readQueue,
  writeQueue,
  enqueueTask,
  dequeueTask,
  peekQueue,
  getQueueLength,
  isQueueFull,
  clearQueue
};
```

**Step 2: Create test file**

Create: `lib/__tests__/queue_manager.test.js`

```javascript
const {
  enqueueTask,
  dequeueTask,
  peekQueue,
  getQueueLength,
  isQueueFull,
  clearQueue
} = require('../queue_manager.cjs');
const fs = require('fs');
const path = require('path');

const QUEUE_PATH = path.join(__dirname, '..', '..', 'state', 'queues', 'test.queue.json');

function cleanup() {
  if (fs.existsSync(QUEUE_PATH)) {
    fs.unlinkSync(QUEUE_PATH);
  }
}

function runTests() {
  console.log('Testing queue_manager...');
  cleanup();

  // Test 1: Enqueue task
  const result1 = enqueueTask('test', { id: 'TASK-001', title: 'Test task' });
  console.assert(result1.success === true, 'Enqueue should succeed');
  console.assert(result1.position === 1, 'Position should be 1');
  console.log('✓ Enqueue task');

  // Test 2: Peek queue
  const peeked = peekQueue('test');
  console.assert(peeked.id === 'TASK-001', 'Peeked task should match');
  console.log('✓ Peek queue');

  // Test 3: Get queue length
  const length = getQueueLength('test');
  console.assert(length === 1, 'Queue length should be 1');
  console.log('✓ Get queue length');

  // Test 4: Enqueue another task
  enqueueTask('test', { id: 'TASK-002', title: 'Another task' });
  console.assert(getQueueLength('test') === 2, 'Queue length should be 2');
  console.log('✓ Enqueue second task');

  // Test 5: Dequeue task (FIFO)
  const dequeued = dequeueTask('test');
  console.assert(dequeued.id === 'TASK-001', 'Dequeued task should be first one');
  console.assert(getQueueLength('test') === 1, 'Queue length should be 1 after dequeue');
  console.log('✓ Dequeue task (FIFO)');

  // Test 6: Clear queue
  clearQueue('test');
  console.assert(getQueueLength('test') === 0, 'Queue should be empty after clear');
  console.log('✓ Clear queue');

  // Test 7: Queue full check
  enqueueTask('test', { id: 'T1' });
  enqueueTask('test', { id: 'T2' });
  enqueueTask('test', { id: 'T3' });
  console.assert(isQueueFull('test') === true, 'Queue should be full');
  console.log('✓ Queue full check');

  // Test 8: Enqueue when full fails
  const resultFull = enqueueTask('test', { id: 'T4' });
  console.assert(resultFull.success === false, 'Enqueue should fail when full');
  console.log('✓ Enqueue fails when full');

  cleanup();
  console.log('All queue_manager tests passed!');
}

runTests();
```

**Step 3: Run tests**

Run: `node lib/__tests__/queue_manager.test.js`
Expected: "All queue_manager tests passed!"

**Step 4: Commit**

```bash
git add lib/queue_manager.cjs lib/__tests__/
git commit -m "feat(orchestrator): add queue management library"
```

---

## Phase 1 Complete Checklist

- [ ] State directory structure created
- [ ] orchestration.yml configuration created
- [ ] Agent spawning library with CLAUDECODE workaround
- [ ] Agent memory file templates created
- [ ] Queue file templates created
- [ ] Queue management library created

**Next Phase:** Phase 2 - Core Agents (spawn/manage agents, orchestrator loop)
