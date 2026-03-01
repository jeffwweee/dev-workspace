# Phase 2: Core Agents - Multi-Agent Orchestrator

> **For Claude:** REQUIRED SUB-SKILL: Use `executing-plans` or `subagent-driven-development` skill to implement this plan task-by-task.
> **Depends on:** Phase 1 - Foundation

**Goal:** Implement core agent management, memory file handling, handoff documents, and the primary orchestrator loop.

**Architecture:** Primary orchestrator runs a polling loop that monitors agent progress files, routes tasks, and handles inter-agent communication. Each agent has a memory file for persistent learning.

**Tech Stack:** Node.js, tmux, file-based state, async polling

---

## Task 2.1: Create Memory File Manager Library

**Files:**
- Create: `lib/memory_manager.cjs`

**Step 1: Write memory manager library**

```javascript
const fs = require('fs');
const path = require('path');

const STATE_DIR = path.join(__dirname, '..', 'state');
const AGENTS_DIR = path.join(STATE_DIR, 'agents');
const WORK_DIR = path.join(STATE_DIR, 'work');
const ARCHIVE_DIR = path.join(STATE_DIR, 'archive');

/**
 * Reads an agent's memory file
 * @param {string} agent - Agent name
 * @returns {string} Memory file content
 */
function readAgentMemory(agent) {
  const memoryPath = path.join(AGENTS_DIR, `${agent}_MEMORY.md`);

  if (!fs.existsSync(memoryPath)) {
    return `# ${agent} Agent Memory\n\n## Essential Context\n\n## Learned Patterns\n\n## Recent Tasks\n\n## Error Resolutions\n`;
  }

  return fs.readFileSync(memoryPath, 'utf-8');
}

/**
 * Writes to an agent's memory file (append)
 * @param {string} agent - Agent name
 * @param {string} section - Section to append to
 * @param {string} content - Content to add
 */
function appendAgentMemory(agent, section, content) {
  const memoryPath = path.join(AGENTS_DIR, `${agent}_MEMORY.md`);
  let memory = readAgentMemory(agent);

  const sectionHeader = `## ${section}`;
  const timestamp = new Date().toISOString().split('T')[0];
  const entry = `\n\n### ${timestamp}\n${content}`;

  // Find section and append
  const lines = memory.split('\n');
  let sectionIndex = lines.findIndex(l => l.trim() === sectionHeader);

  if (sectionIndex === -1) {
    // Section doesn't exist, add it at the end
    memory += `\n\n${sectionHeader}${entry}`;
  } else {
    // Find next section or end of file
    let nextSectionIndex = lines.slice(sectionIndex + 1).findIndex(l => l.startsWith('## '));
    if (nextSectionIndex === -1) {
      nextSectionIndex = lines.length;
    } else {
      nextSectionIndex += sectionIndex + 1;
    }

    // Insert at the right place
    lines.splice(nextSectionIndex, 0, entry);
    memory = lines.join('\n');
  }

  fs.writeFileSync(memoryPath, memory);
}

/**
 * Reads primary orchestrator memory
 * @returns {string} Memory content
 */
function readPrimaryMemory() {
  const memoryPath = path.join(STATE_DIR, 'PRIMARY_MEMORY.md');

  if (!fs.existsSync(memoryPath)) {
    return `# Primary Orchestrator Memory\n\n## Essential Context\n\n## Active Tasks\n\n## Recent Completions\n\n## Learnings\n\n## Metrics\n`;
  }

  return fs.readFileSync(memoryPath, 'utf-8');
}

/**
 * Updates primary orchestrator memory
 * @param {Object} updates - Sections to update
 */
function updatePrimaryMemory(updates) {
  const memoryPath = path.join(STATE_DIR, 'PRIMARY_MEMORY.md');
  let memory = readPrimaryMemory();

  for (const [section, content] of Object.entries(updates)) {
    const sectionHeader = `## ${section}`;
    const lines = memory.split('\n');
    let sectionIndex = lines.findIndex(l => l.trim() === sectionHeader);

    if (sectionIndex !== -1) {
      // Find next section
      let nextSectionIndex = lines.slice(sectionIndex + 1).findIndex(l => l.startsWith('## '));
      if (nextSectionIndex === -1) {
        nextSectionIndex = lines.length;
      } else {
        nextSectionIndex += sectionIndex + 1;
      }

      // Replace content
      lines.splice(sectionIndex + 1, nextSectionIndex - sectionIndex - 1, `\n${content}`);
      memory = lines.join('\n');
    }
  }

  fs.writeFileSync(memoryPath, memory);
}

/**
 * Creates a progress file for an agent's task
 * @param {string} agent - Agent name
 * @param {string} taskId - Task ID
 * @param {Object} taskInfo - Task information
 */
function createProgressFile(agent, taskId, taskInfo) {
  const progressPath = path.join(WORK_DIR, `${agent}_${taskId}_PROGRESS.md`);

  const content = `# Progress: ${taskId}

**Agent:** ${agent}
**Status:** IN_PROGRESS
**Started:** ${new Date().toISOString()}

## Task Description
${taskInfo.description || 'No description'}

## Acceptance Criteria
${(taskInfo.acceptanceCriteria || []).map(c => `- [ ] ${c}`).join('\n')}

## Progress Log
### ${new Date().toISOString()}
Task started

## Files Changed
<!-- Auto-populated as work progresses -->

## Blockers
<!-- Any blockers encountered -->

## Handoff Notes
<!-- Notes for next agent in pipeline -->
`;

  fs.writeFileSync(progressPath, content);
}

/**
 * Updates a progress file
 * @param {string} agent - Agent name
 * @param {string} taskId - Task ID
 * @param {Object} updates - Updates to apply
 */
function updateProgressFile(agent, taskId, updates) {
  const progressPath = path.join(WORK_DIR, `${agent}_${taskId}_PROGRESS.md`);

  if (!fs.existsSync(progressPath)) {
    return false;
  }

  let content = fs.readFileSync(progressPath, 'utf-8');

  if (updates.status) {
    content = content.replace(/\*\*Status:\*\* \w+/, `**Status:** ${updates.status}`);
  }

  if (updates.log) {
    const timestamp = new Date().toISOString();
    content += `\n\n### ${timestamp}\n${updates.log}`;
  }

  if (updates.files) {
    const filesSection = `## Files Changed\n${updates.files.map(f => `- ${f}`).join('\n')}`;
    content = content.replace(/## Files Changed[\s\S]*?(?=## |$)/, filesSection);
  }

  if (updates.blockers) {
    const blockersSection = `## Blockers\n${updates.blockers}`;
    content = content.replace(/## Blockers[\s\S]*?(?=## |$)/, blockersSection);
  }

  fs.writeFileSync(progressPath, content);
  return true;
}

/**
 * Reads a progress file
 * @param {string} agent - Agent name
 * @param {string} taskId - Task ID
 * @returns {Object|null} Parsed progress or null
 */
function readProgressFile(agent, taskId) {
  const progressPath = path.join(WORK_DIR, `${agent}_${taskId}_PROGRESS.md`);

  if (!fs.existsSync(progressPath)) {
    return null;
  }

  const content = fs.readFileSync(progressPath, 'utf-8');
  const statusMatch = content.match(/\*\*Status:\*\* (\w+)/);
  const startedMatch = content.match(/\*\*Started:\*\* (.+)/);

  return {
    agent,
    taskId,
    status: statusMatch ? statusMatch[1] : 'UNKNOWN',
    started: startedMatch ? startedMatch[1] : null,
    raw: content
  };
}

/**
 * Archives old memory files
 * @param {string} agent - Agent name (or 'PRIMARY')
 */
function archiveMemory(agent) {
  const sourcePath = agent === 'PRIMARY'
    ? path.join(STATE_DIR, 'PRIMARY_MEMORY.md')
    : path.join(AGENTS_DIR, `${agent}_MEMORY.md`);

  if (!fs.existsSync(sourcePath)) {
    return false;
  }

  const date = new Date().toISOString().split('T')[0].slice(0, 7); // YYYY-MM
  const archiveSubDir = path.join(ARCHIVE_DIR, date);

  if (!fs.existsSync(archiveSubDir)) {
    fs.mkdirSync(archiveSubDir, { recursive: true });
  }

  const filename = agent === 'PRIMARY'
    ? `PRIMARY_${date}.md`
    : `${agent}_MEMORY_${date}.md`;

  const destPath = path.join(archiveSubDir, filename);
  fs.copyFileSync(sourcePath, destPath);

  return destPath;
}

module.exports = {
  readAgentMemory,
  appendAgentMemory,
  readPrimaryMemory,
  updatePrimaryMemory,
  createProgressFile,
  updateProgressFile,
  readProgressFile,
  archiveMemory
};
```

**Step 2: Create test file**

Create: `lib/__tests__/memory_manager.test.js`

```javascript
const {
  readAgentMemory,
  appendAgentMemory,
  readPrimaryMemory,
  createProgressFile,
  readProgressFile,
  updateProgressFile
} = require('../memory_manager.cjs');
const fs = require('fs');
const path = require('path');

const TEST_AGENT = 'test-mem-agent';
const TEST_TASK = 'TEST-001';

function cleanup() {
  // Clean up test files
  const agentMem = path.join(__dirname, '..', '..', 'state', 'agents', `${TEST_AGENT}_MEMORY.md`);
  const progress = path.join(__dirname, '..', '..', 'state', 'work', `${TEST_AGENT}_${TEST_TASK}_PROGRESS.md`);

  if (fs.existsSync(agentMem)) fs.unlinkSync(agentMem);
  if (fs.existsSync(progress)) fs.unlinkSync(progress);
}

function runTests() {
  console.log('Testing memory_manager...');
  cleanup();

  // Test 1: Read non-existent agent memory returns template
  const memory1 = readAgentMemory(TEST_AGENT);
  console.assert(memory1.includes('# test-mem-agent Agent Memory'), 'Should return template');
  console.log('✓ Read agent memory template');

  // Test 2: Append to agent memory
  appendAgentMemory(TEST_AGENT, 'Learned Patterns', 'Test pattern learned');
  const memory2 = readAgentMemory(TEST_AGENT);
  console.assert(memory2.includes('Test pattern learned'), 'Should contain appended content');
  console.log('✓ Append to agent memory');

  // Test 3: Create progress file
  createProgressFile(TEST_AGENT, TEST_TASK, {
    description: 'Test task description',
    acceptanceCriteria: ['Criteria 1', 'Criteria 2']
  });
  const progress = readProgressFile(TEST_AGENT, TEST_TASK);
  console.assert(progress !== null, 'Progress should exist');
  console.assert(progress.status === 'IN_PROGRESS', 'Status should be IN_PROGRESS');
  console.assert(progress.agent === TEST_AGENT, 'Agent should match');
  console.log('✓ Create and read progress file');

  // Test 4: Update progress file status
  updateProgressFile(TEST_AGENT, TEST_TASK, { status: 'COMPLETE' });
  const progress2 = readProgressFile(TEST_AGENT, TEST_TASK);
  console.assert(progress2.status === 'COMPLETE', 'Status should be updated');
  console.log('✓ Update progress file status');

  // Test 5: Add log entry
  updateProgressFile(TEST_AGENT, TEST_TASK, { log: 'Made progress on task' });
  const progress3 = readProgressFile(TEST_AGENT, TEST_TASK);
  console.assert(progress3.raw.includes('Made progress on task'), 'Log should be present');
  console.log('✓ Add log entry to progress');

  // Test 6: Read primary memory
  const primary = readPrimaryMemory();
  console.assert(primary.includes('# Primary Orchestrator Memory'), 'Should have primary memory header');
  console.log('✓ Read primary memory');

  cleanup();
  console.log('All memory_manager tests passed!');
}

runTests();
```

**Step 3: Run tests**

Run: `node lib/__tests__/memory_manager.test.js`
Expected: "All memory_manager tests passed!"

**Step 4: Commit**

```bash
git add lib/memory_manager.cjs lib/__tests__/
git commit -m "feat(orchestrator): add memory file management library"
```

---

## Task 2.2: Create Handoff Document Generator

**Files:**
- Create: `lib/handoff.cjs`

**Step 1: Write handoff generator**

```javascript
const fs = require('fs');
const path = require('path');

const WORK_DIR = path.join(__dirname, '..', 'state', 'work');

/**
 * Creates a handoff document for transitioning between agents
 * @param {Object} options - Handoff options
 * @param {string} options.from - Source agent
 * @param {string} options.to - Target agent
 * @param {string} options.taskId - Task ID
 * @param {string} options.status - COMPLETE | BLOCKED | FAILED
 * @param {number} options.confidence - Confidence score (0-1)
 * @param {string} options.summary - Work summary
 * @param {string[]} options.filesChanged - List of changed files
 * @param {string[]} options.learnings - Learnings for next agent
 * @param {string} options.blockers - Blocker description (if any)
 * @param {string[]} options.recommendations - Recommendations for next agent
 */
function createHandoff(options) {
  const {
    from,
    to,
    taskId,
    status,
    confidence,
    summary,
    filesChanged = [],
    learnings = [],
    blockers = 'None',
    recommendations = []
  } = options;

  const handoff = `# HANDOFF: ${from} → ${to}

## Task: ${taskId}
## Status: ${status}
## Confidence: ${confidence}

## Summary
${summary}

## Files Changed
${filesChanged.length > 0 ? filesChanged.map(f => `- ${f}`).join('\n') : '- None'}

## Learnings for Next Agent
${learnings.length > 0 ? learnings.map(l => `- ${l}`).join('\n') : '- None'}

## Blockers (if any)
${blockers}

## Recommendations for Next Agent
${recommendations.length > 0 ? recommendations.map(r => `- ${r}`).join('\n') : '- None'}

---
*Generated at: ${new Date().toISOString()}*
`;

  return handoff;
}

/**
 * Saves a handoff document
 * @param {string} handoff - Handoff content
 * @param {string} taskId - Task ID
 * @param {string} from - Source agent
 * @param {string} to - Target agent
 */
function saveHandoff(handoff, taskId, from, to) {
  const handoffPath = path.join(WORK_DIR, `HANDOFF_${taskId}_${from}_to_${to}.md`);
  fs.writeFileSync(handoffPath, handoff);
  return handoffPath;
}

/**
 * Reads a handoff document
 * @param {string} taskId - Task ID
 * @param {string} from - Source agent
 * @param {string} to - Target agent
 * @returns {Object|null} Parsed handoff or null
 */
function readHandoff(taskId, from, to) {
  const handoffPath = path.join(WORK_DIR, `HANDOFF_${taskId}_${from}_to_${to}.md`);

  if (!fs.existsSync(handoffPath)) {
    return null;
  }

  const content = fs.readFileSync(handoffPath, 'utf-8');

  // Parse handoff
  const statusMatch = content.match(/## Status: (\w+)/);
  const confidenceMatch = content.match(/## Confidence: ([\d.]+)/);
  const summaryMatch = content.match(/## Summary\n([\s\S]*?)(?=## Files Changed)/);
  const learningsMatch = content.match(/## Learnings for Next Agent\n([\s\S]*?)(?=## Blockers)/);

  return {
    taskId,
    from,
    to,
    status: statusMatch ? statusMatch[1] : 'UNKNOWN',
    confidence: confidenceMatch ? parseFloat(confidenceMatch[1]) : 0,
    summary: summaryMatch ? summaryMatch[1].trim() : '',
    learnings: learningsMatch ? learningsMatch[1].trim().split('\n').filter(l => l.startsWith('- ')).map(l => l.slice(2)) : [],
    raw: content,
    path: handoffPath
  };
}

/**
 * Lists all handoff documents for a task
 * @param {string} taskId - Task ID
 * @returns {string[]} List of handoff file paths
 */
function listHandoffs(taskId) {
  if (!fs.existsSync(WORK_DIR)) {
    return [];
  }

  return fs.readdirSync(WORK_DIR)
    .filter(f => f.startsWith(`HANDOFF_${taskId}_`))
    .map(f => path.join(WORK_DIR, f));
}

module.exports = {
  createHandoff,
  saveHandoff,
  readHandoff,
  listHandoffs
};
```

**Step 2: Create test file**

Create: `lib/__tests__/handoff.test.js`

```javascript
const { createHandoff, saveHandoff, readHandoff, listHandoffs } = require('../handoff.cjs');
const fs = require('fs');
const path = require('path');

const TEST_TASK = 'HANDOFF-TEST-001';
const WORK_DIR = path.join(__dirname, '..', '..', 'state', 'work');

function cleanup() {
  const handoffs = listHandoffs(TEST_TASK);
  for (const h of handoffs) {
    if (fs.existsSync(h)) fs.unlinkSync(h);
  }
}

function runTests() {
  console.log('Testing handoff...');
  cleanup();

  // Test 1: Create handoff document
  const handoff = createHandoff({
    from: 'backend',
    to: 'review-git',
    taskId: TEST_TASK,
    status: 'COMPLETE',
    confidence: 0.85,
    summary: 'Implemented user auth',
    filesChanged: ['src/auth.ts', 'src/middleware/jwt.ts'],
    learnings: ['Custom auth library, not Passport', 'Strict TypeScript'],
    blockers: 'None',
    recommendations: ['Review JWT expiry logic']
  });

  console.assert(handoff.includes('HANDOFF: backend → review-git'), 'Should have header');
  console.assert(handoff.includes('Status: COMPLETE'), 'Should have status');
  console.assert(handoff.includes('Confidence: 0.85'), 'Should have confidence');
  console.assert(handoff.includes('src/auth.ts'), 'Should have files');
  console.log('✓ Create handoff document');

  // Test 2: Save handoff
  const savedPath = saveHandoff(handoff, TEST_TASK, 'backend', 'review-git');
  console.assert(fs.existsSync(savedPath), 'File should exist');
  console.log('✓ Save handoff document');

  // Test 3: Read handoff
  const read = readHandoff(TEST_TASK, 'backend', 'review-git');
  console.assert(read !== null, 'Should read handoff');
  console.assert(read.status === 'COMPLETE', 'Status should match');
  console.assert(read.confidence === 0.85, 'Confidence should match');
  console.assert(read.learnings.includes('Custom auth library, not Passport'), 'Learnings should match');
  console.log('✓ Read and parse handoff');

  // Test 4: List handoffs
  const allHandoffs = listHandoffs(TEST_TASK);
  console.assert(allHandoffs.length === 1, 'Should have one handoff');
  console.log('✓ List handoffs');

  cleanup();
  console.log('All handoff tests passed!');
}

runTests();
```

**Step 3: Run tests**

Run: `node lib/__tests__/handoff.test.js`
Expected: "All handoff tests passed!"

**Step 4: Commit**

```bash
git add lib/handoff.cjs lib/__tests__/
git commit -m "feat(orchestrator): add handoff document generator"
```

---

## Task 2.3: Create Orchestrator Config Loader

**Files:**
- Create: `lib/orchestration_config.cjs`

**Step 1: Write config loader**

```javascript
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const CONFIG_PATH = path.join(__dirname, '..', 'config', 'orchestration.yml');

let cachedConfig = null;

/**
 * Loads orchestration configuration
 * @returns {Object} Configuration object
 */
function loadConfig() {
  if (cachedConfig) {
    return cachedConfig;
  }

  if (!fs.existsSync(CONFIG_PATH)) {
    // Return defaults
    cachedConfig = {
      orchestration: {
        loop_interval_ms: 30000,
        telegram_poll_interval_ms: 5000,
        plan_watch_enabled: true,
        plan_watch_paths: ['docs/plans/*.md']
      },
      limits: {
        max_adhoc_per_type: 2,
        max_total_adhoc: 5,
        max_queue_length: 3
      },
      cleanup: {
        adhoc_idle_timeout_ms: 1800000,
        core_agent_clear_on_complete: true
      },
      archiving: {
        max_file_size_kb: 50,
        max_task_count: 50,
        weekly_archive: true
      },
      workflows: {
        default: {
          pipeline: ['backend', 'review-git', 'frontend', 'review-git', 'qa'],
          review_threshold: 0.8,
          max_retries: 3,
          retry_backoff_base_ms: 30000
        }
      }
    };
    return cachedConfig;
  }

  const content = fs.readFileSync(CONFIG_PATH, 'utf-8');
  cachedConfig = yaml.load(content);
  return cachedConfig;
}

/**
 * Gets a specific workflow configuration
 * @param {string} workflowName - Workflow name
 * @returns {Object} Workflow config
 */
function getWorkflow(workflowName = 'default') {
  const config = loadConfig();
  return config.workflows[workflowName] || config.workflows.default;
}

/**
 * Gets limits configuration
 * @returns {Object} Limits config
 */
function getLimits() {
  const config = loadConfig();
  return config.limits;
}

/**
 * Gets cleanup configuration
 * @returns {Object} Cleanup config
 */
function getCleanup() {
  const config = loadConfig();
  return config.cleanup;
}

/**
 * Gets archiving configuration
 * @returns {Object} Archiving config
 */
function getArchiving() {
  const config = loadConfig();
  return config.archiving;
}

/**
 * Clears config cache (for testing)
 */
function clearCache() {
  cachedConfig = null;
}

module.exports = {
  loadConfig,
  getWorkflow,
  getLimits,
  getCleanup,
  getArchiving,
  clearCache
};
```

**Step 2: Create test file**

Create: `lib/__tests__/orchestration_config.test.js`

```javascript
const { loadConfig, getWorkflow, getLimits, clearCache } = require('../orchestration_config.cjs');

function runTests() {
  console.log('Testing orchestration_config...');
  clearCache();

  // Test 1: Load config
  const config = loadConfig();
  console.assert(config.orchestration !== undefined, 'Should have orchestration section');
  console.assert(config.limits !== undefined, 'Should have limits section');
  console.assert(config.workflows !== undefined, 'Should have workflows section');
  console.log('✓ Load config');

  // Test 2: Get default workflow
  const defaultWorkflow = getWorkflow();
  console.assert(Array.isArray(defaultWorkflow.pipeline), 'Should have pipeline array');
  console.assert(defaultWorkflow.pipeline.includes('backend'), 'Should have backend stage');
  console.assert(typeof defaultWorkflow.review_threshold === 'number', 'Should have threshold');
  console.log('✓ Get default workflow');

  // Test 3: Get limits
  const limits = getLimits();
  console.assert(typeof limits.max_adhoc_per_type === 'number', 'Should have max_adhoc_per_type');
  console.assert(typeof limits.max_queue_length === 'number', 'Should have max_queue_length');
  console.log('✓ Get limits');

  // Test 4: Non-existent workflow returns default
  const unknownWorkflow = getWorkflow('nonexistent');
  console.assert(unknownWorkflow.pipeline !== undefined, 'Should return default for unknown');
  console.log('✓ Unknown workflow returns default');

  console.log('All orchestration_config tests passed!');
}

runTests();
```

**Step 4: Run tests**

Run: `node lib/__tests__/orchestration_config.test.js`
Expected: "All orchestration_config tests passed!"

**Step 5: Commit**

```bash
git add lib/orchestration_config.cjs lib/__tests__/
git commit -m "feat(orchestrator): add orchestration config loader"
```

---

## Task 2.4: Create Primary Orchestrator Loop

**Files:**
- Create: `lib/orchestrator.cjs`

**Step 1: Write orchestrator loop**

```javascript
const {
  spawnAgent,
  killAgent,
  isAgentRunning,
  sendToAgent,
  listAgentSessions
} = require('./spawn_agent.cjs');

const {
  readQueue,
  enqueueTask,
  dequeueTask,
  getQueueLength,
  isQueueFull
} = require('./queue_manager.cjs');

const {
  readAgentMemory,
  appendAgentMemory,
  readPrimaryMemory,
  updatePrimaryMemory,
  createProgressFile,
  readProgressFile,
  updateProgressFile
} = require('./memory_manager.cjs');

const {
  createHandoff,
  saveHandoff,
  readHandoff
} = require('./handoff.cjs');

const {
  loadConfig,
  getWorkflow,
  getLimits
} = require('./orchestration_config.cjs');

const CORE_AGENTS = ['backend', 'frontend', 'qa', 'review-git'];

/**
 * Orchestrator state
 */
let state = {
  isRunning: false,
  loopCount: 0,
  activeTasks: new Map(), // taskId -> { agent, status, started }
  lastSync: null
};

/**
 * Initializes the orchestrator
 */
async function initialize() {
  console.log('[Orchestrator] Initializing...');

  // Ensure core agents are running
  for (const agent of CORE_AGENTS) {
    if (!isAgentRunning(agent)) {
      console.log(`[Orchestrator] Spawning ${agent} agent...`);
      spawnAgent({
        name: agent,
        memoryFile: `state/agents/${agent}_MEMORY.md`,
        isAdhoc: false
      });
    } else {
      console.log(`[Orchestrator] ${agent} agent already running`);
    }
  }

  state.isRunning = true;
  console.log('[Orchestrator] Initialized with agents:', listAgentSessions());
}

/**
 * Main orchestrator loop
 */
async function runLoop() {
  const config = loadConfig();

  while (state.isRunning) {
    state.loopCount++;
    console.log(`\n[Orchestrator] Loop ${state.loopCount} - ${new Date().toISOString()}`);

    try {
      // 1. Check entry points (queues, files, etc.)
      await checkEntryPoints();

      // 2. Monitor active tasks
      await monitorActiveTasks();

      // 3. Process queue assignments
      await processQueues();

      // 4. Sync learning (every 10 loops)
      if (state.loopCount % 10 === 0) {
        await syncLearning();
      }

    } catch (error) {
      console.error('[Orchestrator] Loop error:', error.message);
    }

    // Sleep until next iteration
    await sleep(config.orchestration.loop_interval_ms);
  }
}

/**
 * Checks entry points for new tasks
 */
async function checkEntryPoints() {
  // Check plan files
  // TODO: Implement file watcher

  // Check Telegram messages
  // TODO: Integrate with existing Telegram gateway
}

/**
 * Monitors active tasks
 */
async function monitorActiveTasks() {
  for (const [taskId, taskInfo] of state.activeTasks) {
    const progress = readProgressFile(taskInfo.agent, taskId);

    if (!progress) {
      console.log(`[Orchestrator] No progress file for ${taskId}`);
      continue;
    }

    console.log(`[Orchestrator] Task ${taskId}: ${progress.status}`);

    if (progress.status === 'COMPLETE') {
      await handleTaskComplete(taskId, taskInfo);
    } else if (progress.status === 'BLOCKED') {
      await handleTaskBlocked(taskId, taskInfo);
    } else if (progress.status === 'FAILED') {
      await handleTaskFailed(taskId, taskInfo);
    }
  }
}

/**
 * Handles task completion
 */
async function handleTaskComplete(taskId, taskInfo) {
  console.log(`[Orchestrator] Task ${taskId} completed by ${taskInfo.agent}`);

  // Create handoff to next stage
  const workflow = getWorkflow(taskInfo.workflow || 'default');
  const currentIndex = workflow.pipeline.indexOf(taskInfo.agent);

  if (currentIndex < workflow.pipeline.length - 1) {
    const nextAgent = workflow.pipeline[currentIndex + 1];

    // Create and save handoff
    const handoff = createHandoff({
      from: taskInfo.agent,
      to: nextAgent,
      taskId,
      status: 'COMPLETE',
      confidence: taskInfo.confidence || 0.8,
      summary: `Task completed by ${taskInfo.agent}`,
      filesChanged: taskInfo.filesChanged || [],
      learnings: taskInfo.learnings || [],
      blockers: 'None',
      recommendations: []
    });

    saveHandoff(handoff, taskId, taskInfo.agent, nextAgent);

    // Queue for next agent
    enqueueTask(nextAgent, {
      id: taskId,
      handoffFrom: taskInfo.agent,
      handoffPath: `state/work/HANDOFF_${taskId}_${taskInfo.agent}_to_${nextAgent}.md`
    });

    console.log(`[Orchestrator] Queued ${taskId} for ${nextAgent}`);
  } else {
    // Task fully complete
    console.log(`[Orchestrator] Task ${taskId} fully complete!`);

    // Update primary memory
    appendAgentMemory('PRIMARY', 'Recent Completions', `- ${taskId} completed at ${new Date().toISOString()}`);
  }

  // Remove from active
  state.activeTasks.delete(taskId);
}

/**
 * Handles blocked task
 */
async function handleTaskBlocked(taskId, taskInfo) {
  console.log(`[Orchestrator] Task ${taskId} blocked by ${taskInfo.agent}`);

  // TODO: Implement retry logic with exponential backoff
  // TODO: Notify via Telegram
}

/**
 * Handles failed task
 */
async function handleTaskFailed(taskId, taskInfo) {
  console.log(`[Orchestrator] Task ${taskId} failed by ${taskInfo.agent}`);

  // TODO: Implement escalation logic
  // TODO: Notify via Telegram
}

/**
 * Processes agent queues
 */
async function processQueues() {
  for (const agent of CORE_AGENTS) {
    const queue = readQueue(agent);

    if (queue.tasks.length > 0 && !state.activeTasks.has(queue.tasks[0].id)) {
      // Check if agent is idle
      // For now, assume first task in queue goes to agent
      const task = dequeueTask(agent);

      if (task) {
        // Create progress file
        createProgressFile(agent, task.id, {
          description: task.description || `Task ${task.id}`
        });

        // Track as active
        state.activeTasks.set(task.id, {
          agent,
          status: 'IN_PROGRESS',
          started: new Date().toISOString(),
          workflow: task.workflow
        });

        // Send task to agent
        sendToAgent(agent, `/skill executing-plans --plan ${task.handoffPath || task.planPath}`);

        console.log(`[Orchestrator] Assigned ${task.id} to ${agent}`);
      }
    }
  }
}

/**
 * Syncs learning to evolution registry
 */
async function syncLearning() {
  console.log('[Orchestrator] Syncing learning...');

  for (const agent of CORE_AGENTS) {
    const memory = readAgentMemory(agent);
    // TODO: Extract patterns and sync to Redis evolution registry
  }

  state.lastSync = new Date().toISOString();
}

/**
 * Submits a new task to the orchestrator
 * @param {Object} task - Task details
 */
async function submitTask(task) {
  const workflow = getWorkflow(task.workflow || 'default');
  const firstAgent = workflow.pipeline[0];

  console.log(`[Orchestrator] Submitting task ${task.id} to ${firstAgent}`);

  const result = enqueueTask(firstAgent, {
    id: task.id,
    description: task.description,
    workflow: task.workflow || 'default',
    planPath: task.planPath,
    enqueued_at: new Date().toISOString()
  });

  if (!result.success) {
    console.log(`[Orchestrator] Queue full for ${firstAgent}, considering adhoc...`);
    // TODO: Implement adhoc spawning logic
  }

  return result;
}

/**
 * Stops the orchestrator
 */
async function stop() {
  console.log('[Orchestrator] Stopping...');
  state.isRunning = false;
}

/**
 * Gets orchestrator status
 */
function getStatus() {
  return {
    isRunning: state.isRunning,
    loopCount: state.loopCount,
    activeTasks: Array.from(state.activeTasks.entries()).map(([id, info]) => ({ id, ...info })),
    queueLengths: Object.fromEntries(CORE_AGENTS.map(a => [a, getQueueLength(a)])),
    runningAgents: listAgentSessions(),
    lastSync: state.lastSync
  };
}

/**
 * Helper: sleep
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  initialize,
  runLoop,
  stop,
  getStatus,
  submitTask,
  CORE_AGENTS
};
```

**Step 2: Commit**

```bash
git add lib/orchestrator.cjs
git commit -m "feat(orchestrator): add primary orchestrator loop"
```

---

## Task 2.5: Create Orchestrator CLI

**Files:**
- Create: `bin/orchestrator.js`

**Step 1: Write CLI**

```javascript
#!/usr/bin/env node

const { program } = require('commander');
const {
  initialize,
  runLoop,
  stop,
  getStatus,
  submitTask,
  CORE_AGENTS
} = require('../lib/orchestrator.cjs');

const {
  spawnAgent,
  killAgent,
  isAgentRunning,
  listAgentSessions
} = require('../lib/spawn_agent.cjs');

const {
  getQueueLength,
  clearQueue
} = require('../lib/queue_manager.cjs');

program
  .name('orchestrator')
  .description('Multi-Agent Orchestrator CLI')
  .version('1.0.0');

program.command('start')
  .description('Start the orchestrator loop')
  .option('--no-spawn', 'Don\'t spawn agents on start')
  .action(async (options) => {
    console.log('Starting orchestrator...');

    if (options.spawn !== false) {
      await initialize();
    }

    console.log('Running orchestrator loop. Press Ctrl+C to stop.');
    console.log('Use: node bin/orchestrator.js status');

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\nShutting down...');
      await stop();
      process.exit(0);
    });

    await runLoop();
  });

program.command('status')
  .description('Show orchestrator status')
  .action(() => {
    const status = getStatus();
    console.log('\n=== Orchestrator Status ===');
    console.log(`Running: ${status.isRunning}`);
    console.log(`Loop Count: ${status.loopCount}`);
    console.log(`Last Sync: ${status.lastSync || 'Never'}`);

    console.log('\n=== Running Agents ===');
    status.runningAgents.forEach(a => console.log(`  - ${a}`));

    console.log('\n=== Queue Lengths ===');
    for (const [agent, length] of Object.entries(status.queueLengths)) {
      console.log(`  ${agent}: ${length}`);
    }

    console.log('\n=== Active Tasks ===');
    if (status.activeTasks.length === 0) {
      console.log('  None');
    } else {
      status.activeTasks.forEach(t => console.log(`  ${t.id}: ${t.agent} (${t.status})`));
    }
  });

program.command('spawn <agent>')
  .description('Spawn a specific agent')
  .option('--adhoc', 'Spawn as adhoc agent')
  .action((agent, options) => {
    const result = spawnAgent({
      name: agent,
      isAdhoc: options.adhoc || false,
      memoryFile: `state/agents/${agent}_MEMORY.md`
    });
    console.log(`Spawn result:`, result);
  });

program.command('kill <agent>')
  .description('Kill an agent session')
  .option('--adhoc', 'Kill adhoc agent')
  .action((agent, options) => {
    const result = killAgent(agent, options.adhoc || false);
    console.log(`Kill result:`, result);
  });

program.command('submit <taskId>')
  .description('Submit a task to the orchestrator')
  .option('-p, --plan <path>', 'Path to plan file')
  .option('-w, --workflow <name>', 'Workflow to use', 'default')
  .action(async (taskId, options) => {
    const result = await submitTask({
      id: taskId,
      planPath: options.plan,
      workflow: options.workflow
    });
    console.log('Submit result:', result);
  });

program.command('queue <agent>')
  .description('Show agent queue')
  .action((agent) => {
    const length = getQueueLength(agent);
    console.log(`${agent} queue length: ${length}`);
  });

program.command('clear-queue <agent>')
  .description('Clear agent queue')
  .action((agent) => {
    clearQueue(agent);
    console.log(`${agent} queue cleared`);
  });

program.command('list')
  .description('List all running agent sessions')
  .action(() => {
    const sessions = listAgentSessions();
    console.log('Running agent sessions:');
    sessions.forEach(s => console.log(`  - ${s}`));
  });

program.parse();
```

**Step 2: Make executable**

Run: `chmod +x bin/orchestrator.js`

**Step 3: Test CLI**

Run: `node bin/orchestrator.js --help`
Expected: CLI help text displayed

**Step 4: Commit**

```bash
git add bin/orchestrator.js
git commit -m "feat(orchestrator): add orchestrator CLI"
```

---

## Phase 2 Complete Checklist

- [ ] Memory file manager library created
- [ ] Handoff document generator created
- [ ] Orchestration config loader created
- [ ] Primary orchestrator loop implemented
- [ ] Orchestrator CLI created

**Next Phase:** Phase 3 - Workflow Pipeline (pipeline routing, review-git integration, confidence thresholds)
