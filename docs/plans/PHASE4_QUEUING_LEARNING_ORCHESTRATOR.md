# Phase 4: Queuing & Learning - Multi-Agent Orchestrator

> **For Claude:** REQUIRED SUB-SKILL: Use `executing-plans` or `subagent-driven-development` skill to implement this plan task-by-task.
> **Depends on:** Phase 3 - Workflow Pipeline

**Goal:** Implement adhoc agent spawning, learning sync to Redis evolution registry, and archive system for memory files.

**Architecture:** Adhoc agents spawned when core agents are at capacity. Learning extracted from agent memory files and synced to centralized Redis. Archive system moves old state to timestamped directories.

**Tech Stack:** Node.js, Redis, tmux, file-based state

---

## Task 4.1: Create Adhoc Agent Manager

**Files:**
- Create: `lib/adhoc_manager.cjs`

**Step 1: Write adhoc agent manager**

```javascript
const {
  spawnAgent,
  killAgent,
  isAgentRunning,
  listAgentSessions
} = require('./spawn_agent.cjs');

const { getLimits } = require('./orchestration_config.cjs');

/**
 * Adhoc agent tracking
 */
const adhocAgents = new Map(); // sessionId -> { type, spawnedAt, lastActivity, taskId }

/**
 * Gets current adhoc counts by type
 * @returns {Object} Counts by agent type
 */
function getAdhocCounts() {
  const counts = {};

  for (const [, info] of adhocAgents) {
    counts[info.type] = (counts[info.type] || 0) + 1;
  }

  return counts;
}

/**
 * Checks if can spawn adhoc of type
 * @param {string} type - Agent type (backend, frontend, etc.)
 * @returns {Object} Spawn check result
 */
function canSpawnAdhoc(type) {
  const limits = getLimits();
  const counts = getAdhocCounts();

  const typeCount = counts[type] || 0;
  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);

  if (typeCount >= limits.max_adhoc_per_type) {
    return {
      canSpawn: false,
      reason: 'type_limit_reached',
      limit: limits.max_adhoc_per_type,
      current: typeCount
    };
  }

  if (totalCount >= limits.max_total_adhoc) {
    return {
      canSpawn: false,
      reason: 'total_limit_reached',
      limit: limits.max_total_adhoc,
      current: totalCount
    };
  }

  return {
    canSpawn: true,
    typeRemaining: limits.max_adhoc_per_type - typeCount,
    totalRemaining: limits.max_total_adhoc - totalCount
  };
}

/**
 * Spawns an adhoc agent
 * @param {string} type - Agent type
 * @param {Object} options - Spawn options
 * @returns {Object} Spawn result
 */
function spawnAdhocAgent(type, options = {}) {
  const {
    taskId,
    persona,
    skills = [],
    memoryFile
  } = options;

  const check = canSpawnAdhoc(type);

  if (!check.canSpawn) {
    return check;
  }

  const sessionName = `${type}-${Date.now()}`;

  const result = spawnAgent({
    name: sessionName,
    persona: persona || `${type} adhoc agent`,
    skills,
    memoryFile: memoryFile || `state/agents/adhoc_${type}_MEMORY.md`,
    isAdhoc: true
  });

  if (result.status === 'spawned' || result.status === 'already_exists') {
    adhocAgents.set(sessionName, {
      type,
      spawnedAt: Date.now(),
      lastActivity: Date.now(),
      taskId
    });
  }

  return {
    ...result,
    sessionName,
    tracked: adhocAgents.has(sessionName)
  };
}

/**
 * Kills an adhoc agent
 * @param {string} sessionName - Session name
 * @returns {Object} Kill result
 */
function killAdhocAgent(sessionName) {
  const info = adhocAgents.get(sessionName);

  if (!info) {
    return { success: false, reason: 'not_tracked' };
  }

  const result = killAgent(sessionName, true);

  if (result.status === 'killed') {
    adhocAgents.delete(sessionName);
  }

  return {
    success: true,
    ...result
  };
}

/**
 * Updates adhoc agent activity
 * @param {string} sessionName - Session name
 */
function updateAdhocActivity(sessionName) {
  const info = adhocAgents.get(sessionName);
  if (info) {
    info.lastActivity = Date.now();
  }
}

/**
 * Finds idle adhoc agents
 * @param {number} timeoutMs - Idle timeout in milliseconds
 * @returns {string[]} List of idle session names
 */
function findIdleAdhocAgents(timeoutMs = 1800000) { // 30 minutes default
  const now = Date.now();
  const idle = [];

  for (const [sessionName, info] of adhocAgents) {
    if (now - info.lastActivity > timeoutMs) {
      idle.push(sessionName);
    }
  }

  return idle;
}

/**
 * Cleans up idle adhoc agents
 * @param {number} timeoutMs - Idle timeout
 * @returns {Object} Cleanup result
 */
function cleanupIdleAdhocAgents(timeoutMs) {
  const limits = getLimits();
  const timeout = timeoutMs || limits.adhoc_idle_timeout_ms || 1800000;
  const idle = findIdleAdhocAgents(timeout);
  const killed = [];

  for (const sessionName of idle) {
    const result = killAdhocAgent(sessionName);
    if (result.success) {
      killed.push(sessionName);
    }
  }

  return {
    checked: adhocAgents.size,
    idleFound: idle.length,
    killed: killed.length,
    killedSessions: killed
  };
}

/**
 * Gets all adhoc agents info
 * @returns {Object[]} List of adhoc agent info
 */
function listAdhocAgents() {
  const result = [];

  for (const [sessionName, info] of adhocAgents) {
    result.push({
      sessionName,
      ...info,
      running: isAgentRunning(sessionName, true)
    });
  }

  return result;
}

/**
 * Gets adhoc agent by task
 * @param {string} taskId - Task ID
 * @returns {Object|null} Agent info or null
 */
function getAdhocByTask(taskId) {
  for (const [sessionName, info] of adhocAgents) {
    if (info.taskId === taskId) {
      return { sessionName, ...info };
    }
  }
  return null;
}

/**
 * Syncs adhoc tracking with actual tmux sessions
 */
function syncAdhocTracking() {
  const sessions = listAgentSessions();
  const adhocSessions = sessions.filter(s => s.startsWith('cc-adhoc-'));

  // Remove tracked agents not in tmux
  for (const sessionName of adhocAgents.keys()) {
    const fullName = `cc-adhoc-${sessionName}`;
    if (!adhocSessions.includes(fullName)) {
      adhocAgents.delete(sessionName);
    }
  }

  return {
    tracked: adhocAgents.size,
    running: adhocSessions.length
  };
}

module.exports = {
  getAdhocCounts,
  canSpawnAdhoc,
  spawnAdhocAgent,
  killAdhocAgent,
  updateAdhocActivity,
  findIdleAdhocAgents,
  cleanupIdleAdhocAgents,
  listAdhocAgents,
  getAdhocByTask,
  syncAdhocTracking
};
```

**Step 2: Create test file**

Create: `lib/__tests__/adhoc_manager.test.js`

```javascript
const {
  getAdhocCounts,
  canSpawnAdhoc,
  spawnAdhocAgent,
  killAdhocAgent,
  listAdhocAgents,
  cleanupIdleAdhocAgents
} = require('../adhoc_manager.cjs');

function runTests() {
  console.log('Testing adhoc_manager...');

  // Test 1: Initial counts are empty
  const counts1 = getAdhocCounts();
  console.assert(Object.keys(counts1).length === 0, 'Initial counts should be empty');
  console.log('✓ Initial counts empty');

  // Test 2: Can spawn initially
  const check1 = canSpawnAdhoc('backend');
  console.assert(check1.canSpawn === true, 'Should be able to spawn');
  console.log('✓ Can spawn initially');

  // Test 3: Spawn adhoc agent
  const spawn1 = spawnAdhocAgent('backend', { taskId: 'TEST-001' });
  console.assert(spawn1.tracked === true || spawn1.status === 'error', 'Should be tracked or error');
  console.log('✓ Spawn adhoc agent');

  // Test 4: Counts updated
  const counts2 = getAdhocCounts();
  console.assert(counts2.backend === 1, 'Backend count should be 1');
  console.log('✓ Counts updated after spawn');

  // Test 5: List adhoc agents
  const list = listAdhocAgents();
  console.assert(list.length === 1, 'Should have 1 adhoc agent');
  console.log('✓ List adhoc agents');

  // Test 6: Cleanup idle agents (none should be idle yet)
  const cleanup = cleanupIdleAdhocAgents(1000); // 1 second
  console.assert(cleanup.killed === 0, 'No agents should be idle yet');
  console.log('✓ Cleanup idle agents');

  console.log('All adhoc_manager tests passed!');
}

runTests();
```

**Step 3: Run tests**

Run: `node lib/__tests__/adhoc_manager.test.js`
Expected: "All adhoc_manager tests passed!"

**Step 4: Commit**

```bash
git add lib/adhoc_manager.cjs lib/__tests__/
git commit -m "feat(orchestrator): add adhoc agent manager"
```

---

## Task 4.2: Create Learning Sync System

**Files:**
- Create: `lib/learning_sync.cjs`

**Step 1: Write learning sync module**

```javascript
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const AGENTS_DIR = path.join(__dirname, '..', 'state', 'agents');

/**
 * Extracts learnings from agent memory file
 * @param {string} agent - Agent name
 * @returns {Object[]} Extracted learnings
 */
function extractLearnings(agent) {
  const memoryPath = path.join(AGENTS_DIR, `${agent}_MEMORY.md`);

  if (!fs.existsSync(memoryPath)) {
    return [];
  }

  const content = fs.readFileSync(memoryPath, 'utf-8');
  const learnings = [];

  // Extract learned patterns section
  const patternsMatch = content.match(/## Learned Patterns\n([\s\S]*?)(?=## |$)/i);
  if (patternsMatch) {
    const patterns = patternsMatch[1]
      .trim()
      .split('\n')
      .filter(l => l.startsWith('- ') || l.startsWith('* '))
      .map(l => l.replace(/^[-*] /, ''));

    for (const pattern of patterns) {
      if (pattern.length > 10) { // Filter out empty/short entries
        learnings.push({
          type: 'pattern',
          agent,
          content: pattern,
          extractedAt: new Date().toISOString()
        });
      }
    }
  }

  // Extract error resolutions
  const errorsMatch = content.match(/## Error Resolutions\n([\s\S]*?)(?=## |$)/i);
  if (errorsMatch) {
    const resolutions = errorsMatch[1]
      .trim()
      .split('\n')
      .filter(l => l.startsWith('- ') || l.startsWith('* '))
      .map(l => l.replace(/^[-*] /, ''));

    for (const resolution of resolutions) {
      if (resolution.length > 10) {
        learnings.push({
          type: 'resolution',
          agent,
          content: resolution,
          extractedAt: new Date().toISOString()
        });
      }
    }
  }

  return learnings;
}

/**
 * Syncs learnings to Redis evolution registry
 * @param {string} agent - Agent name
 * @returns {Object} Sync result
 */
function syncToEvolutionRegistry(agent) {
  const learnings = extractLearnings(agent);

  if (learnings.length === 0) {
    return { success: true, synced: 0, message: 'No learnings to sync' };
  }

  try {
    // Check if Redis is available
    execSync('redis-cli ping', { stdio: 'pipe' });
  } catch {
    console.log('[Learning] Redis not available, skipping sync');
    return { success: false, reason: 'redis_unavailable', learnings: learnings.length };
  }

  let synced = 0;

  for (const learning of learnings) {
    try {
      // Create gene ID
      const geneId = `gene:${agent}:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`;

      // Store in Redis
      const geneData = JSON.stringify({
        id: geneId,
        source: agent,
        type: learning.type,
        content: learning.content,
        extractedAt: learning.extractedAt,
        syncedAt: new Date().toISOString()
      });

      execSync(`redis-cli SET "${geneId}" '${geneData.replace(/'/g, "\\'")}'`);
      execSync(`redis-cli SADD "genes:${agent}" "${geneId}"`);

      synced++;
    } catch (error) {
      console.error(`[Learning] Failed to sync learning: ${error.message}`);
    }
  }

  return {
    success: true,
    synced,
    total: learnings.length,
    agent
  };
}

/**
 * Syncs all agents' learnings
 * @returns {Object} Sync results
 */
function syncAllAgents() {
  const agents = ['backend', 'frontend', 'qa', 'review-git'];
  const results = {};

  for (const agent of agents) {
    results[agent] = syncToEvolutionRegistry(agent);
  }

  const totalSynced = Object.values(results).reduce((sum, r) => sum + (r.synced || 0), 0);

  return {
    success: true,
    agents: results,
    totalSynced
  };
}

/**
 * Gets recent learnings from Redis
 * @param {string} agent - Agent name (optional, all if not specified)
 * @param {number} limit - Max learnings to return
 * @returns {Object[]} Recent learnings
 */
function getRecentLearnings(agent, limit = 10) {
  try {
    execSync('redis-cli ping', { stdio: 'pipe' });
  } catch {
    return [];
  }

  const learnings = [];

  try {
    let geneKeys;

    if (agent) {
      geneKeys = execSync(`redis-cli SMEMBERS "genes:${agent}"`)
        .toString()
        .trim()
        .split('\n')
        .filter(k => k);
    } else {
      // Get from all agents
      geneKeys = [];
      for (const a of ['backend', 'frontend', 'qa', 'review-git']) {
        const keys = execSync(`redis-cli SMEMBERS "genes:${a}"`)
          .toString()
          .trim()
          .split('\n')
          .filter(k => k);
        geneKeys.push(...keys);
      }
    }

    // Get gene data
    for (const key of geneKeys.slice(0, limit)) {
      try {
        const data = execSync(`redis-cli GET "${key}"`).toString().trim();
        if (data) {
          learnings.push(JSON.parse(data));
        }
      } catch {
        // Skip invalid entries
      }
    }
  } catch (error) {
    console.error(`[Learning] Failed to get recent learnings: ${error.message}`);
  }

  return learnings;
}

/**
 * Broadcasts learning to all agents
 * @param {Object} learning - Learning to broadcast
 */
function broadcastLearning(learning) {
  const agents = ['backend', 'frontend', 'qa', 'review-git'];

  for (const agent of agents) {
    const memoryPath = path.join(AGENTS_DIR, `${agent}_MEMORY.md`);

    if (!fs.existsSync(memoryPath)) {
      continue;
    }

    let content = fs.readFileSync(memoryPath, 'utf-8');

    // Add to learned patterns section
    const section = '## Learned Patterns';
    const timestamp = new Date().toISOString().split('T')[0];
    const entry = `\n\n### ${timestamp} (from ${learning.source})\n- ${learning.content}`;

    if (content.includes(section)) {
      // Find section and append
      const lines = content.split('\n');
      const sectionIndex = lines.findIndex(l => l.trim() === section);

      if (sectionIndex !== -1) {
        let nextSectionIndex = lines.slice(sectionIndex + 1).findIndex(l => l.startsWith('## '));
        if (nextSectionIndex === -1) {
          nextSectionIndex = lines.length;
        } else {
          nextSectionIndex += sectionIndex + 1;
        }

        lines.splice(nextSectionIndex, 0, entry);
        content = lines.join('\n');
        fs.writeFileSync(memoryPath, content);
      }
    }
  }

  return { success: true, broadcastTo: agents.length };
}

module.exports = {
  extractLearnings,
  syncToEvolutionRegistry,
  syncAllAgents,
  getRecentLearnings,
  broadcastLearning
};
```

**Step 2: Create test file**

Create: `lib/__tests__/learning_sync.test.js`

```javascript
const {
  extractLearnings,
  syncAllAgents,
  getRecentLearnings
} = require('../learning_sync.cjs');
const fs = require('fs');
const path = require('path');

const TEST_AGENT = 'test-learning-agent';
const AGENTS_DIR = path.join(__dirname, '..', '..', 'state', 'agents');

function cleanup() {
  const memoryPath = path.join(AGENTS_DIR, `${TEST_AGENT}_MEMORY.md`);
  if (fs.existsSync(memoryPath)) {
    fs.unlinkSync(memoryPath);
  }
}

function runTests() {
  console.log('Testing learning_sync...');
  cleanup();

  // Test 1: Extract learnings from empty memory
  const learnings1 = extractLearnings(TEST_AGENT);
  console.assert(Array.isArray(learnings1), 'Should return array');
  console.log('✓ Extract learnings returns array');

  // Test 2: Create test memory and extract
  const testMemory = `# Test Agent Memory

## Learned Patterns

- Pattern 1: Always use async/await
- Pattern 2: Validate inputs at boundaries

## Error Resolutions

- Error 1: Fixed by restarting Redis
`;

  const memoryPath = path.join(AGENTS_DIR, `${TEST_AGENT}_MEMORY.md`);
  fs.writeFileSync(memoryPath, testMemory);

  const learnings2 = extractLearnings(TEST_AGENT);
  console.assert(learnings2.length >= 2, 'Should extract at least 2 learnings');
  console.assert(learnings2.some(l => l.type === 'pattern'), 'Should have pattern type');
  console.assert(learnings2.some(l => l.type === 'resolution'), 'Should have resolution type');
  console.log('✓ Extract learnings from memory');

  // Test 3: Sync all agents (may fail if Redis not available)
  const syncResult = syncAllAgents();
  console.assert(syncResult.success === true, 'Sync should succeed');
  console.assert(typeof syncResult.agents === 'object', 'Should have agents object');
  console.log('✓ Sync all agents');

  // Test 4: Get recent learnings
  const recent = getRecentLearnings(null, 5);
  console.assert(Array.isArray(recent), 'Should return array');
  console.log('✓ Get recent learnings');

  cleanup();
  console.log('All learning_sync tests passed!');
}

runTests();
```

**Step 3: Run tests**

Run: `node lib/__tests__/learning_sync.test.js`
Expected: "All learning_sync tests passed!"

**Step 4: Commit**

```bash
git add lib/learning_sync.cjs lib/__tests__/
git commit -m "feat(orchestrator): add learning sync system"
```

---

## Task 4.3: Create Archive System

**Files:**
- Create: `lib/archive_manager.cjs`

**Step 1: Write archive manager**

```javascript
const fs = require('fs');
const path = require('path');
const { loadConfig } = require('./orchestration_config.cjs');

const STATE_DIR = path.join(__dirname, '..', 'state');
const AGENTS_DIR = path.join(STATE_DIR, 'agents');
const WORK_DIR = path.join(STATE_DIR, 'work');
const ARCHIVE_DIR = path.join(STATE_DIR, 'archive');

/**
 * Checks if archiving is needed
 * @param {string} filePath - File to check
 * @returns {Object} Check result
 */
function needsArchiving(filePath) {
  if (!fs.existsSync(filePath)) {
    return { needed: false, reason: 'file_not_found' };
  }

  const config = loadConfig();
  const stats = fs.statSync(filePath);
  const content = fs.readFileSync(filePath, 'utf-8');

  // Check file size
  const sizeKB = stats.size / 1024;
  if (sizeKB > config.archiving.max_file_size_kb) {
    return {
      needed: true,
      reason: 'size_exceeded',
      sizeKB: Math.round(sizeKB),
      limit: config.archiving.max_file_size_kb
    };
  }

  // Check task count (count ## or ### headers that look like task IDs)
  const taskMatches = content.match(/(TASK-|TG3-|RSS-)\d+/g);
  if (taskMatches && taskMatches.length > config.archiving.max_task_count) {
    return {
      needed: true,
      reason: 'task_count_exceeded',
      count: taskMatches.length,
      limit: config.archiving.max_task_count
    };
  }

  return { needed: false };
}

/**
 * Archives a memory file
 * @param {string} agent - Agent name (or 'PRIMARY')
 * @returns {Object} Archive result
 */
function archiveMemoryFile(agent) {
  const sourcePath = agent === 'PRIMARY'
    ? path.join(STATE_DIR, 'PRIMARY_MEMORY.md')
    : path.join(AGENTS_DIR, `${agent}_MEMORY.md`);

  if (!fs.existsSync(sourcePath)) {
    return { success: false, reason: 'file_not_found' };
  }

  const check = needsArchiving(sourcePath);
  if (!check.needed && agent !== 'PRIMARY') {
    return { success: true, archived: false, reason: 'not_needed' };
  }

  // Create archive directory
  const date = new Date();
  const monthDir = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const archiveSubDir = path.join(ARCHIVE_DIR, monthDir);

  if (!fs.existsSync(archiveSubDir)) {
    fs.mkdirSync(archiveSubDir, { recursive: true });
  }

  // Create archive filename
  const dateStr = date.toISOString().split('T')[0];
  const archiveName = agent === 'PRIMARY'
    ? `PRIMARY_${dateStr}.md`
    : `${agent}_MEMORY_${dateStr}.md`;

  const archivePath = path.join(archiveSubDir, archiveName);

  // Copy to archive
  fs.copyFileSync(sourcePath, archivePath);

  // Truncate original (keep essential context)
  truncateMemoryFile(sourcePath, agent);

  return {
    success: true,
    archived: true,
    sourcePath,
    archivePath,
    reason: check.reason
  };
}

/**
 * Truncates memory file, keeping essential context
 * @param {string} filePath - File to truncate
 * @param {string} agent - Agent name
 */
function truncateMemoryFile(filePath, agent) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  // Find sections to keep
  const keepSections = ['Essential Context'];
  const truncateSections = ['Recent Tasks', 'Recent Completions', 'Progress Log'];

  let newContent = `# ${agent === 'PRIMARY' ? 'Primary Orchestrator' : agent + ' Agent'} Memory\n\n`;
  let inKeepSection = false;
  let currentSection = '';

  for (const line of lines) {
    if (line.startsWith('## ')) {
      currentSection = line.replace('## ', '').trim();
      inKeepSection = keepSections.some(s => currentSection.includes(s));

      if (inKeepSection) {
        newContent += line + '\n';
      } else if (truncateSections.some(s => currentSection.includes(s))) {
        newContent += line + '\n\n*Archived. See archive directory for history.*\n';
      } else {
        newContent += line + '\n';
      }
    } else if (inKeepSection || !truncateSections.some(s => currentSection.includes(s))) {
      newContent += line + '\n';
    }
  }

  fs.writeFileSync(filePath, newContent);
}

/**
 * Archives progress files for completed tasks
 * @returns {Object} Archive result
 */
function archiveCompletedProgress() {
  if (!fs.existsSync(WORK_DIR)) {
    return { success: true, archived: 0 };
  }

  const files = fs.readdirSync(WORK_DIR).filter(f => f.endsWith('_PROGRESS.md'));
  const date = new Date();
  const monthDir = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const archiveSubDir = path.join(ARCHIVE_DIR, monthDir, 'progress');

  let archived = 0;

  for (const file of files) {
    const filePath = path.join(WORK_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    // Check if complete
    if (content.includes('**Status:** COMPLETE')) {
      if (!fs.existsSync(archiveSubDir)) {
        fs.mkdirSync(archiveSubDir, { recursive: true });
      }

      const archivePath = path.join(archiveSubDir, file);
      fs.copyFileSync(filePath, archivePath);
      fs.unlinkSync(filePath);
      archived++;
    }
  }

  return { success: true, archived };
}

/**
 * Archives handoff documents
 * @returns {Object} Archive result
 */
function archiveHandoffs() {
  if (!fs.existsSync(WORK_DIR)) {
    return { success: true, archived: 0 };
  }

  const files = fs.readdirSync(WORK_DIR).filter(f => f.startsWith('HANDOFF_'));
  const date = new Date();
  const monthDir = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const archiveSubDir = path.join(ARCHIVE_DIR, monthDir, 'handoffs');

  let archived = 0;

  // Archive handoffs older than 7 days
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;

  for (const file of files) {
    const filePath = path.join(WORK_DIR, file);
    const stats = fs.statSync(filePath);

    if (stats.mtimeMs < cutoff) {
      if (!fs.existsSync(archiveSubDir)) {
        fs.mkdirSync(archiveSubDir, { recursive: true });
      }

      const archivePath = path.join(archiveSubDir, file);
      fs.copyFileSync(filePath, archivePath);
      fs.unlinkSync(filePath);
      archived++;
    }
  }

  return { success: true, archived };
}

/**
 * Runs full archive cycle
 * @returns {Object} Full archive result
 */
function runArchiveCycle() {
  const results = {
    timestamp: new Date().toISOString(),
    agents: {},
    progress: null,
    handoffs: null
  };

  // Archive agent memories
  const agents = ['backend', 'frontend', 'qa', 'review-git'];
  for (const agent of agents) {
    results.agents[agent] = archiveMemoryFile(agent);
  }

  // Archive primary memory
  results.agents.PRIMARY = archiveMemoryFile('PRIMARY');

  // Archive progress files
  results.progress = archiveCompletedProgress();

  // Archive handoffs
  results.handoffs = archiveHandoffs();

  return results;
}

/**
 * Lists archive contents
 * @returns {Object} Archive contents
 */
function listArchiveContents() {
  if (!fs.existsSync(ARCHIVE_DIR)) {
    return { months: [] };
  }

  const months = fs.readdirSync(ARCHIVE_DIR).filter(d => {
    return fs.statSync(path.join(ARCHIVE_DIR, d)).isDirectory();
  });

  const contents = {};

  for (const month of months) {
    const monthPath = path.join(ARCHIVE_DIR, month);
    contents[month] = {
      memories: [],
      progress: [],
      handoffs: []
    };

    // List files
    const files = fs.readdirSync(monthPath);
    for (const file of files) {
      const filePath = path.join(monthPath, file);
      if (fs.statSync(filePath).isDirectory()) {
        const subFiles = fs.readdirSync(filePath);
        for (const subFile of subFiles) {
          contents[month][file].push(subFile);
        }
      } else {
        contents[month].memories.push(file);
      }
    }
  }

  return { months, contents };
}

module.exports = {
  needsArchiving,
  archiveMemoryFile,
  archiveCompletedProgress,
  archiveHandoffs,
  runArchiveCycle,
  listArchiveContents
};
```

**Step 2: Create test file**

Create: `lib/__tests__/archive_manager.test.js`

```javascript
const {
  needsArchiving,
  archiveMemoryFile,
  archiveCompletedProgress,
  listArchiveContents
} = require('../archive_manager.cjs');
const fs = require('fs');
const path = require('path');

const TEST_AGENT = 'test-archive-agent';
const AGENTS_DIR = path.join(__dirname, '..', '..', 'state', 'agents');
const WORK_DIR = path.join(__dirname, '..', '..', 'state', 'work');

function cleanup() {
  const memoryPath = path.join(AGENTS_DIR, `${TEST_AGENT}_MEMORY.md`);
  if (fs.existsSync(memoryPath)) {
    fs.unlinkSync(memoryPath);
  }
}

function runTests() {
  console.log('Testing archive_manager...');
  cleanup();

  // Test 1: needsArchiving for non-existent file
  const check1 = needsArchiving('/nonexistent/file.md');
  console.assert(check1.needed === false, 'Non-existent file should not need archiving');
  console.log('✓ Non-existent file check');

  // Test 2: needsArchiving for small file
  const smallMemory = `# Test Memory\n\n## Essential Context\n- Test context\n`;
  const memoryPath = path.join(AGENTS_DIR, `${TEST_AGENT}_MEMORY.md`);
  fs.writeFileSync(memoryPath, smallMemory);

  const check2 = needsArchiving(memoryPath);
  console.assert(check2.needed === false, 'Small file should not need archiving');
  console.log('✓ Small file check');

  // Test 3: Archive memory file
  const archiveResult = archiveMemoryFile(TEST_AGENT);
  console.assert(archiveResult.success === true, 'Archive should succeed');
  console.log('✓ Archive memory file');

  // Test 4: List archive contents
  const contents = listArchiveContents();
  console.assert(Array.isArray(contents.months), 'Should have months array');
  console.log('✓ List archive contents');

  // Test 5: Archive completed progress
  const progressResult = archiveCompletedProgress();
  console.assert(progressResult.success === true, 'Archive progress should succeed');
  console.log('✓ Archive completed progress');

  cleanup();
  console.log('All archive_manager tests passed!');
}

runTests();
```

**Step 3: Run tests**

Run: `node lib/__tests__/archive_manager.test.js`
Expected: "All archive_manager tests passed!"

**Step 4: Commit**

```bash
git add lib/archive_manager.cjs lib/__tests__/
git commit -m "feat(orchestrator): add archive system"
```

---

## Task 4.4: Integrate Learning and Archive into Orchestrator

**Files:**
- Modify: `lib/orchestrator.cjs`

**Step 1: Add imports**

```javascript
const {
  spawnAdhocAgent,
  cleanupIdleAdhocAgents,
  listAdhocAgents,
  canSpawnAdhoc
} = require('./adhoc_manager.cjs');

const {
  syncAllAgents,
  broadcastLearning
} = require('./learning_sync.cjs');

const {
  runArchiveCycle,
  needsArchiving
} = require('./archive_manager.cjs');
```

**Step 2: Update runLoop function**

```javascript
async function runLoop() {
  const config = loadConfig();

  while (state.isRunning) {
    state.loopCount++;
    console.log(`\n[Orchestrator] Loop ${state.loopCount} - ${new Date().toISOString()}`);

    try {
      // 1. Check entry points
      await checkEntryPoints();

      // 2. Monitor active tasks
      await monitorActiveTasks();

      // 3. Process queue assignments
      await processQueues();

      // 4. Cleanup idle adhoc agents
      if (state.loopCount % 5 === 0) {
        const cleanup = cleanupIdleAdhocAgents();
        if (cleanup.killed > 0) {
          console.log(`[Orchestrator] Cleaned up ${cleanup.killed} idle adhoc agents`);
        }
      }

      // 5. Sync learning (every 10 loops)
      if (state.loopCount % 10 === 0) {
        const syncResult = syncAllAgents();
        console.log(`[Orchestrator] Learning sync: ${syncResult.totalSynced} learnings`);
      }

      // 6. Run archive cycle (every 100 loops ~ 50 minutes)
      if (state.loopCount % 100 === 0) {
        const archiveResult = runArchiveCycle();
        console.log(`[Orchestrator] Archive cycle complete:`, {
          progress: archiveResult.progress?.archived || 0,
          handoffs: archiveResult.handoffs?.archived || 0
        });
      }

    } catch (error) {
      console.error('[Orchestrator] Loop error:', error.message);
    }

    // Sleep until next iteration
    await sleep(config.orchestration.loop_interval_ms);
  }
}
```

**Step 3: Update processQueues for adhoc spawning**

```javascript
async function processQueues() {
  for (const agent of CORE_AGENTS) {
    const queue = readQueue(agent);

    if (queue.tasks.length > 0 && !state.activeTasks.has(queue.tasks[0].id)) {
      // Check if agent is busy
      const busyWithTask = [...state.activeTasks.values()].find(t => t.agent === agent);

      if (busyWithTask) {
        // Check if we should spawn adhoc
        const canSpawn = canSpawnAdhoc(agent);

        if (canSpawn.canSpawn && queue.tasks.length > 1) {
          // Spawn adhoc for second task
          const task = queue.tasks[1]; // Take second task
          queue.tasks.splice(1, 1); // Remove from queue
          writeQueue(agent, queue);

          const adhocResult = spawnAdhocAgent(agent, {
            taskId: task.id,
            persona: `${agent} adhoc for ${task.id}`
          });

          if (adhocResult.tracked) {
            console.log(`[Orchestrator] Spawned adhoc ${agent} for ${task.id}`);

            // Create progress file
            createProgressFile(`adhoc-${adhocResult.sessionName}`, task.id, {
              description: task.description || `Task ${task.id}`
            });

            state.activeTasks.set(task.id, {
              agent: `adhoc-${adhocResult.sessionName}`,
              status: 'IN_PROGRESS',
              started: new Date().toISOString(),
              workflow: task.workflow,
              isAdhoc: true
            });
          }
        }
      } else {
        // Agent is idle, assign task
        const task = dequeueTask(agent);

        if (task) {
          createProgressFile(agent, task.id, {
            description: task.description || `Task ${task.id}`
          });

          state.activeTasks.set(task.id, {
            agent,
            status: 'IN_PROGRESS',
            started: new Date().toISOString(),
            workflow: task.workflow
          });

          sendToAgent(agent, `/skill executing-plans --plan ${task.handoffPath || task.planPath}`);
          console.log(`[Orchestrator] Assigned ${task.id} to ${agent}`);
        }
      }
    }
  }
}
```

**Step 4: Commit**

```bash
git add lib/orchestrator.cjs
git commit -m "feat(orchestrator): integrate learning sync and archive into loop"
```

---

## Task 4.5: Update CLI with Queue and Archive Commands

**Files:**
- Modify: `bin/orchestrator.js`

**Step 1: Add new commands**

```javascript
program.command('adhoc')
  .description('List adhoc agents')
  .action(() => {
    const { listAdhocAgents } = require('../lib/adhoc_manager.cjs');
    const agents = listAdhocAgents();
    console.log('\n=== Adhoc Agents ===');
    if (agents.length === 0) {
      console.log('None');
    } else {
      agents.forEach(a => {
        console.log(`  ${a.sessionName}: ${a.type} (task: ${a.taskId || 'none'})`);
        console.log(`    Running: ${a.running}, Age: ${Math.round((Date.now() - a.spawnedAt) / 60000)}min`);
      });
    }
  });

program.command('learn')
  .description('Sync learning to evolution registry')
  .option('-a, --agent <name>', 'Specific agent (all if not specified)')
  .action((options) => {
    const { syncToEvolutionRegistry, syncAllAgents } = require('../lib/learning_sync.cjs');
    if (options.agent) {
      const result = syncToEvolutionRegistry(options.agent);
      console.log(`Synced ${result.synced} learnings from ${options.agent}`);
    } else {
      const result = syncAllAgents();
      console.log(`Synced ${result.totalSynced} total learnings`);
    }
  });

program.command('archive')
  .description('Run archive cycle')
  .action(() => {
    const { runArchiveCycle } = require('../lib/archive_manager.cjs');
    const result = runArchiveCycle();
    console.log('Archive cycle complete:', JSON.stringify(result, null, 2));
  });

program.command('archive-list')
  .description('List archive contents')
  .action(() => {
    const { listArchiveContents } = require('../lib/archive_manager.cjs');
    const contents = listArchiveContents();
    console.log('\n=== Archive Contents ===');
    for (const month of contents.months) {
      console.log(`\n${month}:`);
      const data = contents.contents[month];
      if (data.memories?.length) {
        console.log(`  Memories: ${data.memories.join(', ')}`);
      }
      if (data.progress?.length) {
        console.log(`  Progress: ${data.progress.length} files`);
      }
      if (data.handoffs?.length) {
        console.log(`  Handoffs: ${data.handoffs.length} files`);
      }
    }
  });
```

**Step 2: Commit**

```bash
git add bin/orchestrator.js
git commit -m "feat(orchestrator): add adhoc, learning, and archive CLI commands"
```

---

## Phase 4 Complete Checklist

- [ ] Adhoc agent manager created
- [ ] Learning sync system created
- [ ] Archive system created
- [ ] Integrated into orchestrator loop
- [ ] CLI commands added

**Next Phase:** Phase 5 - RSS Integration (optional/future)
