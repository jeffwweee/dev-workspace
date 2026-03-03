# Phase 2: Core Libraries - Orchestrator Overhaul

> **For Claude:** REQUIRED SUB-SKILL: Use `executing-plans` or `plan-parallel` skill to implement this plan task-by-task.
> **Depends on:** Phase 1 - Foundation

**Goal:** Implement core libraries for queue management, memory handling, handoff documents, config loading, and the main orchestrator loop.

**Architecture:** File-based state management with TypeScript libraries. Queue manager handles agent queues, memory manager handles agent memory files, handoff manages inter-agent communication, orchestrator runs the main coordination loop.

**Tech Stack:** TypeScript, file-based state, YAML parsing

---

## Task 2.1: Create lib/queue-manager.ts

**Files:**
- Create: `lib/queue-manager.ts`
- Create: `lib/__tests__/queue-manager.test.ts`

**Step 1: Write queue-manager.ts**

```typescript
import * as fs from 'fs';
import * as path from 'path';

const PENDING_DIR = path.join(__dirname, '..', 'state', 'pending');

export interface QueueTask {
  id: string;
  description?: string;
  workflow?: string;
  planPath?: string;
  handoffPath?: string;
  priority?: number;
  enqueued_at?: string;
  position?: number;
}

export interface Queue {
  agent: string;
  max_length: number;
  tasks: QueueTask[];
}

export interface EnqueueResult {
  success: boolean;
  position?: number;
  estimated_wait_ms?: number;
  reason?: string;
  max_length?: number;
}

/**
 * Reads an agent's queue
 */
export function readQueue(agent: string): Queue {
  const queuePath = path.join(PENDING_DIR, `${agent}.json`);

  if (!fs.existsSync(queuePath)) {
    return { agent, max_length: 3, tasks: [] };
  }

  return JSON.parse(fs.readFileSync(queuePath, 'utf-8'));
}

/**
 * Writes an agent's queue
 */
export function writeQueue(agent: string, queue: Queue): void {
  const queuePath = path.join(PENDING_DIR, `${agent}.json`);
  fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2));
}

/**
 * Adds a task to an agent's queue
 */
export function enqueueTask(agent: string, task: QueueTask): EnqueueResult {
  const queue = readQueue(agent);

  if (queue.tasks.length >= queue.max_length) {
    return { success: false, reason: 'queue_full', max_length: queue.max_length };
  }

  const taskEntry: QueueTask = {
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
 */
export function dequeueTask(agent: string): QueueTask | null {
  const queue = readQueue(agent);

  if (queue.tasks.length === 0) {
    return null;
  }

  const task = queue.tasks.shift();
  writeQueue(agent, queue);

  return task || null;
}

/**
 * Peeks at the next task without removing it
 */
export function peekQueue(agent: string): QueueTask | null {
  const queue = readQueue(agent);
  return queue.tasks.length > 0 ? queue.tasks[0] : null;
}

/**
 * Gets queue length
 */
export function getQueueLength(agent: string): number {
  const queue = readQueue(agent);
  return queue.tasks.length;
}

/**
 * Checks if queue is at capacity
 */
export function isQueueFull(agent: string): boolean {
  const queue = readQueue(agent);
  return queue.tasks.length >= queue.max_length;
}

/**
 * Clears all tasks from an agent's queue
 */
export function clearQueue(agent: string): void {
  writeQueue(agent, { agent, max_length: 3, tasks: [] });
}
```

**Step 2: Write test file**

`lib/__tests__/queue-manager.test.ts`:
```typescript
import {
  enqueueTask,
  dequeueTask,
  peekQueue,
  getQueueLength,
  isQueueFull,
  clearQueue
} from '../queue-manager';
import * as fs from 'fs';
import * as path from 'path';

const TEST_AGENT = 'test-queue';
const PENDING_DIR = path.join(__dirname, '..', '..', 'state', 'pending');
const TEST_QUEUE_PATH = path.join(PENDING_DIR, `${TEST_AGENT}.json`);

function cleanup() {
  if (fs.existsSync(TEST_QUEUE_PATH)) {
    fs.unlinkSync(TEST_QUEUE_PATH);
  }
}

describe('queue-manager', () => {
  afterEach(cleanup);

  test('enqueueTask adds task to queue', () => {
    const result = enqueueTask(TEST_AGENT, { id: 'TASK-001' });
    expect(result.success).toBe(true);
    expect(result.position).toBe(1);
  });

  test('peekQueue returns first task without removing', () => {
    enqueueTask(TEST_AGENT, { id: 'TASK-001' });
    enqueueTask(TEST_AGENT, { id: 'TASK-002' });

    const task = peekQueue(TEST_AGENT);
    expect(task?.id).toBe('TASK-001');
    expect(getQueueLength(TEST_AGENT)).toBe(2);
  });

  test('dequeueTask removes and returns first task', () => {
    enqueueTask(TEST_AGENT, { id: 'TASK-001' });
    enqueueTask(TEST_AGENT, { id: 'TASK-002' });

    const task = dequeueTask(TEST_AGENT);
    expect(task?.id).toBe('TASK-001');
    expect(getQueueLength(TEST_AGENT)).toBe(1);
  });

  test('isQueueFull returns false when under limit', () => {
    enqueueTask(TEST_AGENT, { id: 'TASK-001' });
    expect(isQueueFull(TEST_AGENT)).toBe(false);
  });

  test('isQueueFull returns true when at limit', () => {
    enqueueTask(TEST_AGENT, { id: 'TASK-001' });
    enqueueTask(TEST_AGENT, { id: 'TASK-002' });
    enqueueTask(TEST_AGENT, { id: 'TASK-003' });
    expect(isQueueFull(TEST_AGENT)).toBe(true);
  });

  test('enqueueTask fails when queue is full', () => {
    enqueueTask(TEST_AGENT, { id: 'TASK-001' });
    enqueueTask(TEST_AGENT, { id: 'TASK-002' });
    enqueueTask(TEST_AGENT, { id: 'TASK-003' });

    const result = enqueueTask(TEST_AGENT, { id: 'TASK-004' });
    expect(result.success).toBe(false);
    expect(result.reason).toBe('queue_full');
  });

  test('clearQueue removes all tasks', () => {
    enqueueTask(TEST_AGENT, { id: 'TASK-001' });
    clearQueue(TEST_AGENT);
    expect(getQueueLength(TEST_AGENT)).toBe(0);
  });
});
```

**Step 3: Run tests**

Run: `npx jest lib/__tests__/queue-manager.test.ts`
Expected: All tests pass

**Step 4: Commit**

```bash
git add lib/queue-manager.ts lib/__tests__/queue-manager.test.ts
git commit -m "feat(orchestrator): add queue manager library"
```

---

## Task 2.2: Create lib/memory-manager.ts

**Files:**
- Create: `lib/memory-manager.ts`
- Create: `lib/__tests__/memory-manager.test.ts`

**Step 1: Write memory-manager.ts**

```typescript
import * as fs from 'fs';
import * as path from 'path';

const STATE_DIR = path.join(__dirname, '..', 'state');
const MEMORY_DIR = path.join(STATE_DIR, 'memory');
const PROGRESS_DIR = path.join(STATE_DIR, 'progress');
const LOG_DIR = path.join(STATE_DIR, 'log');

export interface ProgressInfo {
  agent: string;
  taskId: string;
  status: string;
  started: string | null;
  raw: string;
}

/**
 * Reads an agent's memory file
 */
export function readAgentMemory(agent: string): string {
  const memoryPath = path.join(MEMORY_DIR, `${agent}.md`);

  if (!fs.existsSync(memoryPath)) {
    return `# ${agent} Agent Memory\n\n## Essential Context\n\n## Learned Patterns\n\n## Recent Tasks\n\n## Error Resolutions\n`;
  }

  return fs.readFileSync(memoryPath, 'utf-8');
}

/**
 * Appends to an agent's memory file
 */
export function appendAgentMemory(agent: string, section: string, content: string): void {
  const memoryPath = path.join(MEMORY_DIR, `${agent}.md`);
  let memory = readAgentMemory(agent);

  const timestamp = new Date().toISOString().split('T')[0];
  const entry = `\n\n### ${timestamp}\n${content}`;

  const sectionHeader = `## ${section}`;

  if (!memory.includes(sectionHeader)) {
    memory += `\n\n${sectionHeader}${entry}`;
  } else {
    // Find section and append
    const lines = memory.split('\n');
    const sectionIndex = lines.findIndex(l => l.trim() === sectionHeader);

    if (sectionIndex !== -1) {
      let nextSectionIndex = lines.slice(sectionIndex + 1).findIndex(l => l.startsWith('## '));
      if (nextSectionIndex === -1) {
        nextSectionIndex = lines.length;
      } else {
        nextSectionIndex += sectionIndex + 1;
      }
      lines.splice(nextSectionIndex, 0, entry);
      memory = lines.join('\n');
    }
  }

  fs.writeFileSync(memoryPath, memory);
}

/**
 * Reads primary orchestrator memory
 */
export function readPrimaryMemory(): string {
  const memoryPath = path.join(STATE_DIR, 'primary.md');

  if (!fs.existsSync(memoryPath)) {
    return `# Primary Orchestrator Memory\n\n## Essential Context\n\n## Active Tasks\n\n## Recent Completions\n\n## Learnings\n\n## Metrics\n`;
  }

  return fs.readFileSync(memoryPath, 'utf-8');
}

/**
 * Creates a progress file for an agent's task
 */
export function createProgressFile(agent: string, taskId: string, taskInfo: { description?: string }): void {
  const progressPath = path.join(PROGRESS_DIR, `${taskId}.md`);

  const content = `# Progress: ${taskId}

**Agent:** ${agent}
**Status:** IN_PROGRESS
**Started:** ${new Date().toISOString()}

## Task Description
${taskInfo.description || 'No description'}

## Progress Log
### ${new Date().toISOString()}
Task started

## Files Changed
<!-- Auto-populated as work progresses -->

## Blockers
<!-- Any blockers encountered -->
`;

  fs.writeFileSync(progressPath, content);
}

/**
 * Updates a progress file
 */
export function updateProgressFile(agent: string, taskId: string, updates: { status?: string; log?: string }): boolean {
  const progressPath = path.join(PROGRESS_DIR, `${taskId}.md`);

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

  fs.writeFileSync(progressPath, content);
  return true;
}

/**
 * Reads a progress file
 */
export function readProgressFile(agent: string, taskId: string): ProgressInfo | null {
  const progressPath = path.join(PROGRESS_DIR, `${taskId}.md`);

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
    started: startedMatch ? startedMatch[1].trim() : null,
    raw: content
  };
}
```

**Step 2: Write test file**

`lib/__tests__/memory-manager.test.ts`:
```typescript
import {
  readAgentMemory,
  appendAgentMemory,
  readPrimaryMemory,
  createProgressFile,
  readProgressFile,
  updateProgressFile
} from '../memory-manager';
import * as fs from 'fs';
import * as path from 'path';

const TEST_AGENT = 'test-memory-agent';
const TEST_TASK = 'TEST-MEM-001';
const MEMORY_DIR = path.join(__dirname, '..', '..', 'state', 'memory');
const PROGRESS_DIR = path.join(__dirname, '..', '..', 'state', 'progress');

function cleanup() {
  const memPath = path.join(MEMORY_DIR, `${TEST_AGENT}.md`);
  const progPath = path.join(PROGRESS_DIR, `${TEST_TASK}.md`);
  if (fs.existsSync(memPath)) fs.unlinkSync(memPath);
  if (fs.existsSync(progPath)) fs.unlinkSync(progPath);
}

describe('memory-manager', () => {
  afterEach(cleanup);

  test('readAgentMemory returns template for non-existent agent', () => {
    const memory = readAgentMemory(TEST_AGENT);
    expect(memory).toContain('# test-memory-agent Agent Memory');
  });

  test('appendAgentMemory adds content to section', () => {
    appendAgentMemory(TEST_AGENT, 'Learned Patterns', 'Test pattern learned');
    const memory = readAgentMemory(TEST_AGENT);
    expect(memory).toContain('Test pattern learned');
  });

  test('createProgressFile creates file with correct structure', () => {
    createProgressFile(TEST_AGENT, TEST_TASK, { description: 'Test task' });
    const progress = readProgressFile(TEST_AGENT, TEST_TASK);
    expect(progress).not.toBeNull();
    expect(progress?.status).toBe('IN_PROGRESS');
    expect(progress?.agent).toBe(TEST_AGENT);
  });

  test('updateProgressFile updates status', () => {
    createProgressFile(TEST_AGENT, TEST_TASK, { description: 'Test' });
    updateProgressFile(TEST_AGENT, TEST_TASK, { status: 'COMPLETE' });
    const progress = readProgressFile(TEST_AGENT, TEST_TASK);
    expect(progress?.status).toBe('COMPLETE');
  });

  test('readPrimaryMemory returns content', () => {
    const memory = readPrimaryMemory();
    expect(memory).toContain('# Primary Orchestrator Memory');
  });
});
```

**Step 3: Run tests**

Run: `npx jest lib/__tests__/memory-manager.test.ts`
Expected: All tests pass

**Step 4: Commit**

```bash
git add lib/memory-manager.ts lib/__tests__/memory-manager.test.ts
git commit -m "feat(orchestrator): add memory manager library"
```

---

## Task 2.3: Create lib/handoff.ts

**Files:**
- Create: `lib/handoff.ts`
- Create: `lib/__tests__/handoff.test.ts`

**Step 1: Write handoff.ts**

```typescript
import * as fs from 'fs';
import * as path from 'path';

const PROGRESS_DIR = path.join(__dirname, '..', 'state', 'progress');

export interface HandoffOptions {
  from: string;
  to: string;
  taskId: string;
  status: 'COMPLETE' | 'BLOCKED' | 'FAILED';
  confidence: number;
  summary: string;
  filesChanged?: string[];
  learnings?: string[];
  blockers?: string;
  recommendations?: string[];
}

export interface HandoffInfo {
  taskId: string;
  from: string;
  to: string;
  status: string;
  confidence: number;
  summary: string;
  learnings: string[];
  raw: string;
  path: string;
}

/**
 * Creates a handoff document
 */
export function createHandoff(options: HandoffOptions): string {
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

  return `# HANDOFF: ${from} → ${to}

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
}

/**
 * Saves a handoff document
 */
export function saveHandoff(handoff: string, taskId: string, from: string, to: string): string {
  const handoffPath = path.join(PROGRESS_DIR, `HANDOFF_${taskId}_${from}_to_${to}.md`);
  fs.writeFileSync(handoffPath, handoff);
  return handoffPath;
}

/**
 * Reads a handoff document
 */
export function readHandoff(taskId: string, from: string, to: string): HandoffInfo | null {
  const handoffPath = path.join(PROGRESS_DIR, `HANDOFF_${taskId}_${from}_to_${to}.md`);

  if (!fs.existsSync(handoffPath)) {
    return null;
  }

  const content = fs.readFileSync(handoffPath, 'utf-8');

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
    learnings: learningsMatch
      ? learningsMatch[1].trim().split('\n').filter(l => l.startsWith('- ')).map(l => l.slice(2))
      : [],
    raw: content,
    path: handoffPath
  };
}

/**
 * Lists all handoff documents for a task
 */
export function listHandoffs(taskId: string): string[] {
  if (!fs.existsSync(PROGRESS_DIR)) {
    return [];
  }

  return fs.readdirSync(PROGRESS_DIR)
    .filter(f => f.startsWith(`HANDOFF_${taskId}_`))
    .map(f => path.join(PROGRESS_DIR, f));
}
```

**Step 2: Write test file**

`lib/__tests__/handoff.test.ts`:
```typescript
import { createHandoff, saveHandoff, readHandoff, listHandoffs } from '../handoff';
import * as fs from 'fs';
import * as path from 'path';

const TEST_TASK = 'HANDOFF-TEST-001';
const PROGRESS_DIR = path.join(__dirname, '..', '..', 'state', 'progress');

function cleanup() {
  const handoffs = listHandoffs(TEST_TASK);
  for (const h of handoffs) {
    if (fs.existsSync(h)) fs.unlinkSync(h);
  }
}

describe('handoff', () => {
  afterEach(cleanup);

  test('createHandoff generates correct document', () => {
    const handoff = createHandoff({
      from: 'backend',
      to: 'review-git',
      taskId: TEST_TASK,
      status: 'COMPLETE',
      confidence: 0.85,
      summary: 'Implemented feature',
      filesChanged: ['src/auth.ts'],
      learnings: ['Custom auth library']
    });

    expect(handoff).toContain('HANDOFF: backend → review-git');
    expect(handoff).toContain('Status: COMPLETE');
    expect(handoff).toContain('Confidence: 0.85');
    expect(handoff).toContain('src/auth.ts');
  });

  test('saveHandoff writes file', () => {
    const handoff = createHandoff({
      from: 'backend',
      to: 'review-git',
      taskId: TEST_TASK,
      status: 'COMPLETE',
      confidence: 0.8,
      summary: 'Test'
    });

    const savedPath = saveHandoff(handoff, TEST_TASK, 'backend', 'review-git');
    expect(fs.existsSync(savedPath)).toBe(true);
  });

  test('readHandoff parses document', () => {
    const handoff = createHandoff({
      from: 'backend',
      to: 'review-git',
      taskId: TEST_TASK,
      status: 'COMPLETE',
      confidence: 0.85,
      summary: 'Test summary',
      learnings: ['Pattern 1', 'Pattern 2']
    });

    saveHandoff(handoff, TEST_TASK, 'backend', 'review-git');
    const read = readHandoff(TEST_TASK, 'backend', 'review-git');

    expect(read).not.toBeNull();
    expect(read?.status).toBe('COMPLETE');
    expect(read?.confidence).toBe(0.85);
    expect(read?.learnings).toContain('Pattern 1');
  });

  test('listHandoffs finds handoff files', () => {
    const handoff = createHandoff({
      from: 'backend',
      to: 'review-git',
      taskId: TEST_TASK,
      status: 'COMPLETE',
      confidence: 0.8,
      summary: 'Test'
    });

    saveHandoff(handoff, TEST_TASK, 'backend', 'review-git');
    const handoffs = listHandoffs(TEST_TASK);
    expect(handoffs.length).toBe(1);
  });
});
```

**Step 3: Run tests**

Run: `npx jest lib/__tests__/handoff.test.ts`
Expected: All tests pass

**Step 4: Commit**

```bash
git add lib/handoff.ts lib/__tests__/handoff.test.ts
git commit -m "feat(orchestrator): add handoff document library"
```

---

## Task 2.4: Create lib/orchestration-config.ts

**Files:**
- Create: `lib/orchestration-config.ts`
- Create: `lib/__tests__/orchestration-config.test.ts`

**Step 1: Install YAML dependency**

```bash
npm install js-yaml @types/js-yaml
```

**Step 2: Write orchestration-config.ts**

```typescript
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

const CONFIG_PATH = path.join(__dirname, '..', 'config', 'orchestration.yml');

export interface BotConfig {
  name: string;
  token: string;
  username?: string;
  role: string;
  tmux: {
    session: string;
    window?: number;
    pane?: number;
  };
  agent_config?: {
    skills?: string[];
    memory?: string;
    outputs?: string[];
  };
  permissions?: {
    allowed_chats?: number[];
    admin_users?: number[];
  };
}

export interface WorkflowConfig {
  pipeline: string[];
  review_threshold: number;
  max_retries?: number;
  retry_backoff_base_ms?: number;
}

export interface OrchestrationConfig {
  bots: BotConfig[];
  workflows: Record<string, WorkflowConfig>;
  limits: {
    max_adhoc_per_type: number;
    max_total_adhoc: number;
    max_queue_length: number;
    adhoc_idle_timeout_ms: number;
  };
  orchestrator: {
    loop_interval_ms: number;
    telegram_poll_interval_ms: number;
    plan_watch_enabled: boolean;
    plan_watch_paths: string[];
  };
  archiving: {
    max_file_size_kb: number;
    max_task_count: number;
    weekly_archive: boolean;
  };
  cleanup: {
    adhoc_idle_timeout_ms: number;
    core_agent_clear_on_complete: boolean;
  };
}

let cachedConfig: OrchestrationConfig | null = null;

/**
 * Loads orchestration configuration
 */
export function loadConfig(): OrchestrationConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`Configuration file not found: ${CONFIG_PATH}`);
  }

  const content = fs.readFileSync(CONFIG_PATH, 'utf-8');
  cachedConfig = yaml.load(content) as OrchestrationConfig;
  return cachedConfig!;
}

/**
 * Gets a specific workflow configuration
 */
export function getWorkflow(workflowName = 'default'): WorkflowConfig {
  const config = loadConfig();
  return config.workflows[workflowName] || config.workflows.default;
}

/**
 * Gets bot by role
 */
export function getBotByRole(role: string): BotConfig | undefined {
  const config = loadConfig();
  return config.bots.find(b => b.role === role);
}

/**
 * Gets all bots
 */
export function getBots(): BotConfig[] {
  const config = loadConfig();
  return config.bots;
}

/**
 * Gets limits configuration
 */
export function getLimits() {
  const config = loadConfig();
  return config.limits;
}

/**
 * Gets orchestrator settings
 */
export function getOrchestratorSettings() {
  const config = loadConfig();
  return config.orchestrator;
}

/**
 * Clears config cache (for testing)
 */
export function clearCache(): void {
  cachedConfig = null;
}
```

**Step 3: Write test file**

`lib/__tests__/orchestration-config.test.ts`:
```typescript
import {
  loadConfig,
  getWorkflow,
  getBotByRole,
  getBots,
  clearCache
} from '../orchestration-config';

describe('orchestration-config', () => {
  beforeEach(clearCache);

  test('loadConfig loads configuration', () => {
    const config = loadConfig();
    expect(config).toBeDefined();
    expect(config.bots).toBeDefined();
    expect(config.workflows).toBeDefined();
  });

  test('getWorkflow returns default workflow', () => {
    const workflow = getWorkflow();
    expect(workflow.pipeline).toContain('backend');
    expect(workflow.review_threshold).toBeGreaterThan(0);
  });

  test('getWorkflow returns named workflow', () => {
    const workflow = getWorkflow('backend_only');
    expect(workflow.pipeline).toContain('backend');
    expect(workflow.pipeline).not.toContain('frontend');
  });

  test('getBotByRole finds orchestrator bot', () => {
    const bot = getBotByRole('orchestrator');
    expect(bot).toBeDefined();
    expect(bot?.name).toBe('pichu');
  });

  test('getBotByRole finds backend bot', () => {
    const bot = getBotByRole('backend');
    expect(bot).toBeDefined();
    expect(bot?.name).toBe('pikachu');
  });

  test('getBots returns all bots', () => {
    const bots = getBots();
    expect(bots.length).toBe(5);
    expect(bots.map(b => b.role)).toContain('orchestrator');
    expect(bots.map(b => b.role)).toContain('backend');
    expect(bots.map(b => b.role)).toContain('frontend');
    expect(bots.map(b => b.role)).toContain('qa');
    expect(bots.map(b => b.role)).toContain('review-git');
  });
});
```

**Step 4: Run tests**

Run: `npx jest lib/__tests__/orchestration-config.test.ts`
Expected: All tests pass

**Step 5: Commit**

```bash
git add lib/orchestration-config.ts lib/__tests__/orchestration-config.test.ts package.json package-lock.json
git commit -m "feat(orchestrator): add orchestration config loader"
```

---

## Task 2.5: Create lib/orchestrator.ts (Main Loop)

**Files:**
- Create: `lib/orchestrator.ts`

**Step 1: Write orchestrator.ts**

```typescript
import {
  spawnAgent,
  killAgent,
  isAgentRunning,
  sendToAgent,
  listAgentSessions,
  getCoreAgents
} from './spawn-agent';

import {
  readQueue,
  enqueueTask,
  dequeueTask,
  getQueueLength,
  isQueueFull
} from './queue-manager';

import {
  readAgentMemory,
  appendAgentMemory,
  readPrimaryMemory,
  createProgressFile,
  readProgressFile,
  updateProgressFile
} from './memory-manager';

import {
  createHandoff,
  saveHandoff,
  readHandoff
} from './handoff';

import {
  loadConfig,
  getWorkflow,
  getLimits,
  getOrchestratorSettings
} from './orchestration-config';

export interface OrchestratorState {
  isRunning: boolean;
  loopCount: number;
  activeTasks: Map<string, { agent: string; status: string; started: string; workflow?: string }>;
  lastSync: string | null;
}

const state: OrchestratorState = {
  isRunning: false,
  loopCount: 0,
  activeTasks: new Map(),
  lastSync: null
};

/**
 * Initializes the orchestrator
 */
export async function initialize(): Promise<void> {
  console.log('[Orchestrator] Initializing...');

  // Ensure core agents are running
  for (const agent of getCoreAgents()) {
    if (!isAgentRunning(agent)) {
      console.log(`[Orchestrator] Spawning ${agent} agent...`);
      spawnAgent({
        name: agent,
        memoryFile: `state/memory/${agent}.md`,
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
export async function runLoop(): Promise<void> {
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

    } catch (error) {
      console.error('[Orchestrator] Loop error:', error);
    }

    // Sleep until next iteration
    await sleep(config.orchestrator.loop_interval_ms);
  }
}

/**
 * Checks entry points for new tasks
 */
async function checkEntryPoints(): Promise<void> {
  // TODO: Implement file watcher for plan files
  // TODO: Implement Telegram poll
}

/**
 * Monitors active tasks
 */
async function monitorActiveTasks(): Promise<void> {
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
      console.log(`[Orchestrator] Task ${taskId} blocked`);
    } else if (progress.status === 'FAILED') {
      console.log(`[Orchestrator] Task ${taskId} failed`);
    }
  }
}

/**
 * Handles task completion
 */
async function handleTaskComplete(taskId: string, taskInfo: { agent: string; workflow?: string }): Promise<void> {
  console.log(`[Orchestrator] Task ${taskId} completed by ${taskInfo.agent}`);

  const workflow = getWorkflow(taskInfo.workflow || 'default');
  const currentIndex = workflow.pipeline.indexOf(taskInfo.agent);

  if (currentIndex === -1 || currentIndex === workflow.pipeline.length - 1) {
    // Task fully complete
    console.log(`[Orchestrator] Task ${taskId} fully complete!`);
    state.activeTasks.delete(taskId);
    return;
  }

  const nextAgent = workflow.pipeline[currentIndex + 1];

  // Create handoff
  const handoff = createHandoff({
    from: taskInfo.agent,
    to: nextAgent,
    taskId,
    status: 'COMPLETE',
    confidence: 0.8,
    summary: `Completed by ${taskInfo.agent}`
  });

  const handoffPath = saveHandoff(handoff, taskId, taskInfo.agent, nextAgent);

  // Enqueue for next agent
  const enqueueResult = enqueueTask(nextAgent, {
    id: taskId,
    handoffFrom: taskInfo.agent,
    handoffPath
  });

  if (enqueueResult.success) {
    console.log(`[Orchestrator] Queued ${taskId} for ${nextAgent}`);
  }

  state.activeTasks.delete(taskId);
}

/**
 * Processes agent queues
 */
async function processQueues(): Promise<void> {
  for (const agent of getCoreAgents()) {
    const queueLength = getQueueLength(agent);

    if (queueLength > 0) {
      // Check if agent is busy
      const busyWithTask = [...state.activeTasks.values()].find(t => t.agent === agent);

      if (!busyWithTask) {
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

          if (task.handoffPath) {
            sendToAgent(agent, `/skill plan-execute --handoff ${task.handoffPath}`);
          } else if (task.planPath) {
            sendToAgent(agent, `/skill plan-execute --plan ${task.planPath}`);
          }

          console.log(`[Orchestrator] Assigned ${task.id} to ${agent}`);
        }
      }
    }
  }
}

/**
 * Submits a new task to the orchestrator
 */
export async function submitTask(task: { id: string; description?: string; workflow?: string; planPath?: string }): Promise<{ success: boolean; position?: number }> {
  const workflow = getWorkflow(task.workflow || 'default');
  const firstAgent = workflow.pipeline[0];

  console.log(`[Orchestrator] Submitting task ${task.id} to ${firstAgent}`);

  const result = enqueueTask(firstAgent, {
    id: task.id,
    description: task.description,
    workflow: task.workflow || 'default',
    planPath: task.planPath
  });

  return result;
}

/**
 * Stops the orchestrator
 */
export async function stop(): Promise<void> {
  console.log('[Orchestrator] Stopping...');
  state.isRunning = false;
}

/**
 * Gets orchestrator status
 */
export function getStatus(): OrchestratorState & { queueLengths: Record<string, number>; runningAgents: string[] } {
  return {
    ...state,
    activeTasks: state.activeTasks,
    queueLengths: Object.fromEntries(getCoreAgents().map(a => [a, getQueueLength(a)])),
    runningAgents: listAgentSessions()
  };
}

/**
 * Helper: sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export { getCoreAgents };
```

**Step 2: Commit**

```bash
git add lib/orchestrator.ts
git commit -m "feat(orchestrator): add main orchestrator loop"
```

---

## Phase 2 Complete Checklist

- [ ] `lib/queue-manager.ts` created with tests
- [ ] `lib/memory-manager.ts` created with tests
- [ ] `lib/handoff.ts` created with tests
- [ ] `lib/orchestration-config.ts` created with tests
- [ ] `lib/orchestrator.ts` main loop created

**Next Phase:** Phase 3 - CLI & Skills (bin/cc-orch.ts, skill reorganization)
