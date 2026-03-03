# Phase 4: Integration - Orchestrator Overhaul

> **For Claude:** REQUIRED SUB-SKILL: Use `executing-plans` or `plan-parallel` skill to implement this plan task-by-task.
> **Depends on:** Phase 3 - CLI & Skills

**Goal:** Implement integration libraries for pipeline routing, review-git agent, Telegram notifications, adhoc agent management, learning sync, and archiving.

**Architecture:** Pipeline router manages workflow stage transitions. Review-git agent handles code review and git ops. Telegram notifier sends alerts. Adhoc manager spawns temporary agents. Learning sync extracts patterns to Redis. Archive manager handles state cleanup.

**Tech Stack:** TypeScript, Redis, Telegram Bot API

---

## Task 4.1: Create lib/pipeline-router.ts

**Files:**
- Create: `lib/pipeline-router.ts`
- Create: `lib/__tests__/pipeline-router.test.ts`

**Step 1: Write pipeline-router.ts**

```typescript
import { getWorkflow } from './orchestration-config';
import { enqueueTask } from './queue-manager';
import { createHandoff, saveHandoff } from './handoff';

export interface RouteResult {
  success: boolean;
  entryStage?: string;
  pipeline?: string[];
  reviewThreshold?: number;
  reason?: string;
}

export interface AdvanceResult {
  success: boolean;
  complete?: boolean;
  nextAgent?: string;
  handoffPath?: string;
  queuePosition?: number;
  estimatedWait?: number;
  reason?: string;
  confidence?: number;
  threshold?: number;
  suggestion?: string;
}

/**
 * Routes a task through the pipeline
 */
export function routeTask(task: { workflow?: string }): RouteResult {
  const workflow = getWorkflow(task.workflow || 'default');
  const firstStage = workflow.pipeline[0];

  if (!firstStage) {
    return { success: false, reason: 'empty_pipeline' };
  }

  return {
    success: true,
    entryStage: firstStage,
    pipeline: workflow.pipeline,
    reviewThreshold: workflow.review_threshold
  };
}

/**
 * Advances task to next pipeline stage
 */
export function advanceToNextStage(
  taskId: string,
  currentAgent: string,
  result: { workflow?: string; status?: string; confidence?: number; summary?: string; filesChanged?: string[]; learnings?: string[] }
): AdvanceResult {
  const workflow = getWorkflow(result.workflow || 'default');
  const pipeline = workflow.pipeline;
  const currentIndex = pipeline.indexOf(currentAgent);

  if (currentIndex === -1) {
    return { success: false, reason: 'agent_not_in_pipeline' };
  }

  if (currentIndex === pipeline.length - 1) {
    return { success: true, complete: true };
  }

  const nextAgent = pipeline[currentIndex + 1];

  // Check confidence threshold if coming from review-git
  if (currentAgent === 'review-git' && result.confidence !== undefined) {
    if (result.confidence < workflow.review_threshold) {
      return {
        success: false,
        reason: 'confidence_below_threshold',
        confidence: result.confidence,
        threshold: workflow.review_threshold,
        suggestion: 'block_and_notify'
      };
    }
  }

  // Create handoff
  const handoff = createHandoff({
    from: currentAgent,
    to: nextAgent,
    taskId,
    status: result.status === 'FAILED' ? 'FAILED' : 'COMPLETE',
    confidence: result.confidence || 0.8,
    summary: result.summary || `Completed by ${currentAgent}`,
    filesChanged: result.filesChanged,
    learnings: result.learnings
  });

  const handoffPath = saveHandoff(handoff, taskId, currentAgent, nextAgent);

  // Enqueue for next agent
  const enqueueResult = enqueueTask(nextAgent, {
    id: taskId,
    handoffFrom: currentAgent,
    handoffPath,
    workflow: result.workflow
  });

  return {
    success: enqueueResult.success,
    nextAgent,
    handoffPath,
    queuePosition: enqueueResult.position,
    estimatedWait: enqueueResult.estimated_wait_ms
  };
}

/**
 * Gets next agent in pipeline
 */
export function getNextAgent(currentAgent: string, workflowName = 'default'): string | null {
  const workflow = getWorkflow(workflowName);
  const pipeline = workflow.pipeline;
  const currentIndex = pipeline.indexOf(currentAgent);

  if (currentIndex === -1 || currentIndex === pipeline.length - 1) {
    return null;
  }

  return pipeline[currentIndex + 1];
}

/**
 * Gets pipeline stage info
 */
export function getStageInfo(agent: string, workflowName = 'default'): {
  agent: string;
  index: number;
  total: number;
  isFirst: boolean;
  isLast: boolean;
  previous: string | null;
  next: string | null;
} {
  const workflow = getWorkflow(workflowName);
  const pipeline = workflow.pipeline;
  const index = pipeline.indexOf(agent);

  return {
    agent,
    index,
    total: pipeline.length,
    isFirst: index === 0,
    isLast: index === pipeline.length - 1,
    previous: index > 0 ? pipeline[index - 1] : null,
    next: index < pipeline.length - 1 ? pipeline[index + 1] : null
  };
}

/**
 * Checks if review is needed before next stage
 */
export function needsReviewBeforeAdvance(currentAgent: string, workflowName = 'default'): boolean {
  const nextAgent = getNextAgent(currentAgent, workflowName);
  return nextAgent === 'review-git';
}
```

**Step 2: Write test file**

`lib/__tests__/pipeline-router.test.ts`:
```typescript
import { routeTask, advanceToNextStage, getNextAgent, getStageInfo, needsReviewBeforeAdvance } from '../pipeline-router';

describe('pipeline-router', () => {
  test('routeTask returns first stage', () => {
    const result = routeTask({ workflow: 'default' });
    expect(result.success).toBe(true);
    expect(result.entryStage).toBe('backend');
  });

  test('getNextAgent returns correct agent', () => {
    expect(getNextAgent('backend')).toBe('review-git');
    expect(getNextAgent('review-git')).toBe('frontend');
    expect(getNextAgent('qa')).toBeNull();
  });

  test('getStageInfo returns correct info', () => {
    const info = getStageInfo('backend');
    expect(info.isFirst).toBe(true);
    expect(info.isLast).toBe(false);
    expect(info.next).toBe('review-git');
  });

  test('needsReviewBeforeAdvance returns true for backend', () => {
    expect(needsReviewBeforeAdvance('backend')).toBe(true);
  });

  test('advanceToNextStage blocks low confidence', () => {
    const result = advanceToNextStage('TASK-001', 'review-git', {
      confidence: 0.5,
      workflow: 'default'
    });
    expect(result.success).toBe(false);
    expect(result.reason).toBe('confidence_below_threshold');
  });
});
```

**Step 3: Run tests**

Run: `npx jest lib/__tests__/pipeline-router.test.ts`
Expected: All tests pass

**Step 4: Commit**

```bash
git add lib/pipeline-router.ts lib/__tests__/pipeline-router.test.ts
git commit -m "feat(orchestrator): add pipeline router"
```

---

## Task 4.2: Create lib/telegram-notifier.ts

**Files:**
- Create: `lib/telegram-notifier.ts`

**Step 1: Write telegram-notifier.ts**

```typescript
import * as https from 'https';
import { getBotByRole } from './orchestration-config';

export interface NotifyResult {
  success: boolean;
  messageId?: number;
  error?: string;
}

/**
 * Sends a Telegram message
 */
export async function sendMessage(chatId: number | string, text: string, options: { parseMode?: string } = {}): Promise<NotifyResult> {
  const bot = getBotByRole('orchestrator');

  if (!bot || !bot.token) {
    return { success: false, error: 'orchestrator bot not configured' };
  }

  const body = JSON.stringify({
    chat_id: chatId,
    text,
    parse_mode: options.parseMode || 'Markdown'
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${bot.token}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.ok) {
            resolve({ success: true, messageId: result.result.message_id });
          } else {
            resolve({ success: false, error: result.description });
          }
        } catch (e) {
          resolve({ success: false, error: 'Failed to parse response' });
        }
      });
    });

    req.on('error', (e) => resolve({ success: false, error: e.message }));
    req.write(body);
    req.end();
  });
}

/**
 * Notifies about blocked task
 */
export async function notifyBlocked(task: { id: string }, agent: string, reason: string): Promise<NotifyResult> {
  const bot = getBotByRole('orchestrator');
  const adminChat = bot?.permissions?.admin_users?.[0];

  if (!adminChat) {
    return { success: false, error: 'No admin chat configured' };
  }

  const text = `⚠️ *Task Blocked*

**Task:** \`${task.id}\`
**Agent:** ${agent}
**Reason:** ${reason}
**Time:** ${new Date().toISOString()}

Action required: Review and decide to retry, reassign, or abort.`;

  return sendMessage(adminChat, text);
}

/**
 * Notifies about failed task
 */
export async function notifyFailed(task: { id: string }, agent: string, error: string): Promise<NotifyResult> {
  const bot = getBotByRole('orchestrator');
  const adminChat = bot?.permissions?.admin_users?.[0];

  if (!adminChat) {
    return { success: false, error: 'No admin chat configured' };
  }

  const text = `❌ *Task Failed*

**Task:** \`${task.id}\`
**Agent:** ${agent}
**Error:** ${error}
**Time:** ${new Date().toISOString()}

Retries exhausted. Manual intervention required.`;

  return sendMessage(adminChat, text);
}

/**
 * Notifies about task completion
 */
export async function notifyComplete(task: { id: string }, workflow: string, duration: string): Promise<NotifyResult> {
  const bot = getBotByRole('orchestrator');
  const adminChat = bot?.permissions?.admin_users?.[0];

  if (!adminChat) {
    return { success: false, error: 'No admin chat configured' };
  }

  const text = `✅ *Task Complete*

**Task:** \`${task.id}\`
**Pipeline:** ${workflow}
**Duration:** ${duration}
**Time:** ${new Date().toISOString()}

All pipeline stages completed successfully.`;

  return sendMessage(adminChat, text);
}

/**
 * Notifies about agent conflict
 */
export async function notifyAgentConflict(
  task: { id: string },
  agentType: string,
  occupiedBy: string,
  queueLength: number
): Promise<NotifyResult> {
  const bot = getBotByRole('orchestrator');
  const adminChat = bot?.permissions?.admin_users?.[0];

  if (!adminChat) {
    return { success: false, error: 'No admin chat configured' };
  }

  const text = `⚠️ *Agent Assignment Conflict*

**Task:** \`${task.id}\`
**Needs:** ${agentType}-agent
**Status:** OCCUPIED by ${occupiedBy}
**Queue:** ${queueLength} task(s) ahead

Options:
[A] Wait in queue
[B] Spawn adhoc agent (uses extra resources)`;

  return sendMessage(adminChat, text);
}

/**
 * Notifies about review rejection
 */
export async function notifyReviewRejected(
  task: { id: string },
  confidence: number,
  threshold: number,
  issues: string[]
): Promise<NotifyResult> {
  const bot = getBotByRole('orchestrator');
  const adminChat = bot?.permissions?.admin_users?.[0];

  if (!adminChat) {
    return { success: false, error: 'No admin chat configured' };
  }

  const issuesList = issues.map(i => `  • ${i}`).join('\n');

  const text = `🔍 *Review Rejected*

**Task:** \`${task.id}\`
**Confidence:** ${confidence} (threshold: ${threshold})

**Issues Found:**
${issuesList}

Action: Code needs revision before proceeding.`;

  return sendMessage(adminChat, text);
}
```

**Step 2: Commit**

```bash
git add lib/telegram-notifier.ts
git commit -m "feat(orchestrator): add Telegram notifier"
```

---

## Task 4.3: Create lib/adhoc-manager.ts

**Files:**
- Create: `lib/adhoc-manager.ts`

**Step 1: Write adhoc-manager.ts**

```typescript
import { spawnAgent, killAgent, isAgentRunning, listAgentSessions } from './spawn-agent';
import { getLimits } from './orchestration-config';

export interface AdhocInfo {
  type: string;
  spawnedAt: number;
  lastActivity: number;
  taskId?: string;
}

const adhocAgents = new Map<string, AdhocInfo>();

/**
 * Gets current adhoc counts by type
 */
export function getAdhocCounts(): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const [, info] of adhocAgents) {
    counts[info.type] = (counts[info.type] || 0) + 1;
  }

  return counts;
}

/**
 * Checks if can spawn adhoc of type
 */
export function canSpawnAdhoc(type: string): { canSpawn: boolean; reason?: string; typeRemaining?: number; totalRemaining?: number } {
  const limits = getLimits();
  const counts = getAdhocCounts();

  const typeCount = counts[type] || 0;
  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);

  if (typeCount >= limits.max_adhoc_per_type) {
    return { canSpawn: false, reason: 'type_limit_reached' };
  }

  if (totalCount >= limits.max_total_adhoc) {
    return { canSpawn: false, reason: 'total_limit_reached' };
  }

  return {
    canSpawn: true,
    typeRemaining: limits.max_adhoc_per_type - typeCount,
    totalRemaining: limits.max_total_adhoc - totalCount
  };
}

/**
 * Spawns an adhoc agent
 */
export function spawnAdhocAgent(type: string, options: { taskId?: string; persona?: string; skills?: string[] } = {}): { success: boolean; sessionName?: string; reason?: string } {
  const check = canSpawnAdhoc(type);

  if (!check.canSpawn) {
    return { success: false, reason: check.reason };
  }

  const sessionName = `${type}-${Date.now()}`;

  const result = spawnAgent({
    name: sessionName,
    persona: options.persona || `${type} adhoc agent`,
    skills: options.skills,
    memoryFile: `state/memory/adhoc-${type}.md`,
    isAdhoc: true
  });

  if (result.status === 'spawned' || result.status === 'already_exists') {
    adhocAgents.set(sessionName, {
      type,
      spawnedAt: Date.now(),
      lastActivity: Date.now(),
      taskId: options.taskId
    });

    return { success: true, sessionName };
  }

  return { success: false, reason: result.error };
}

/**
 * Kills an adhoc agent
 */
export function killAdhocAgent(sessionName: string): { success: boolean; reason?: string } {
  const info = adhocAgents.get(sessionName);

  if (!info) {
    return { success: false, reason: 'not_tracked' };
  }

  const result = killAgent(sessionName, true);

  if (result.status === 'spawned') { // 'spawned' means killed
    adhocAgents.delete(sessionName);
    return { success: true };
  }

  return { success: false, reason: result.error };
}

/**
 * Updates adhoc agent activity
 */
export function updateAdhocActivity(sessionName: string): void {
  const info = adhocAgents.get(sessionName);
  if (info) {
    info.lastActivity = Date.now();
  }
}

/**
 * Finds idle adhoc agents
 */
export function findIdleAdhocAgents(timeoutMs?: number): string[] {
  const limits = getLimits();
  const timeout = timeoutMs || limits.adhoc_idle_timeout_ms || 1800000;
  const now = Date.now();
  const idle: string[] = [];

  for (const [sessionName, info] of adhocAgents) {
    if (now - info.lastActivity > timeout) {
      idle.push(sessionName);
    }
  }

  return idle;
}

/**
 * Cleans up idle adhoc agents
 */
export function cleanupIdleAdhocAgents(timeoutMs?: number): { checked: number; killed: number; killedSessions: string[] } {
  const idle = findIdleAdhocAgents(timeoutMs);
  const killed: string[] = [];

  for (const sessionName of idle) {
    const result = killAdhocAgent(sessionName);
    if (result.success) {
      killed.push(sessionName);
    }
  }

  return {
    checked: adhocAgents.size,
    killed: killed.length,
    killedSessions: killed
  };
}

/**
 * Lists all adhoc agents
 */
export function listAdhocAgents(): Array<{ sessionName: string; running: boolean } & AdhocInfo> {
  const result: Array<{ sessionName: string; running: boolean } & AdhocInfo> = [];

  for (const [sessionName, info] of adhocAgents) {
    result.push({
      sessionName,
      ...info,
      running: isAgentRunning(sessionName, true)
    });
  }

  return result;
}
```

**Step 2: Commit**

```bash
git add lib/adhoc-manager.ts
git commit -m "feat(orchestrator): add adhoc agent manager"
```

---

## Task 4.4: Create lib/learning-sync.ts

**Files:**
- Create: `lib/learning-sync.ts`

**Step 1: Write learning-sync.ts**

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const MEMORY_DIR = path.join(__dirname, '..', 'state', 'memory');

export interface Learning {
  type: 'pattern' | 'resolution';
  agent: string;
  content: string;
  extractedAt: string;
}

/**
 * Extracts learnings from agent memory file
 */
export function extractLearnings(agent: string): Learning[] {
  const memoryPath = path.join(MEMORY_DIR, `${agent}.md`);

  if (!fs.existsSync(memoryPath)) {
    return [];
  }

  const content = fs.readFileSync(memoryPath, 'utf-8');
  const learnings: Learning[] = [];

  // Extract learned patterns section
  const patternsMatch = content.match(/## Learned Patterns\n([\s\S]*?)(?=## |$)/i);
  if (patternsMatch) {
    const patterns = patternsMatch[1]
      .trim()
      .split('\n')
      .filter(l => l.startsWith('- ') || l.startsWith('* '))
      .map(l => l.replace(/^[-*] /, ''));

    for (const pattern of patterns) {
      if (pattern.length > 10) {
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
 */
export function syncToEvolutionRegistry(agent: string): { success: boolean; synced: number; total: number } {
  const learnings = extractLearnings(agent);

  if (learnings.length === 0) {
    return { success: true, synced: 0, total: 0 };
  }

  // Check if Redis is available
  try {
    execSync('redis-cli ping', { stdio: 'pipe' });
  } catch {
    console.log('[Learning] Redis not available, skipping sync');
    return { success: false, synced: 0, total: learnings.length };
  }

  let synced = 0;

  for (const learning of learnings) {
    try {
      const geneId = `gene:${agent}:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`;

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
      console.error(`[Learning] Failed to sync learning`);
    }
  }

  return { success: true, synced, total: learnings.length };
}

/**
 * Syncs all agents' learnings
 */
export function syncAllAgents(): { success: boolean; agents: Record<string, { synced: number; total: number }>; totalSynced: number } {
  const agents = ['backend', 'frontend', 'qa', 'review-git'];
  const results: Record<string, { synced: number; total: number }> = {};

  for (const agent of agents) {
    results[agent] = syncToEvolutionRegistry(agent);
  }

  const totalSynced = Object.values(results).reduce((sum, r) => sum + r.synced, 0);

  return { success: true, agents: results, totalSynced };
}
```

**Step 2: Commit**

```bash
git add lib/learning-sync.ts
git commit -m "feat(orchestrator): add learning sync library"
```

---

## Task 4.5: Create lib/archive-manager.ts

**Files:**
- Create: `lib/archive-manager.ts`

**Step 1: Write archive-manager.ts**

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { loadConfig } from './orchestration-config';

const STATE_DIR = path.join(__dirname, '..', 'state');
const MEMORY_DIR = path.join(STATE_DIR, 'memory');
const PROGRESS_DIR = path.join(STATE_DIR, 'progress');
const LOG_DIR = path.join(STATE_DIR, 'log');

/**
 * Checks if archiving is needed
 */
export function needsArchiving(filePath: string): { needed: boolean; reason?: string } {
  if (!fs.existsSync(filePath)) {
    return { needed: false, reason: 'file_not_found' };
  }

  const config = loadConfig();
  const stats = fs.statSync(filePath);
  const content = fs.readFileSync(filePath, 'utf-8');

  const sizeKB = stats.size / 1024;
  if (sizeKB > config.archiving.max_file_size_kb) {
    return { needed: true, reason: 'size_exceeded' };
  }

  const taskMatches = content.match(/(TASK-|TG3-|RSS-)\d+/g);
  if (taskMatches && taskMatches.length > config.archiving.max_task_count) {
    return { needed: true, reason: 'task_count_exceeded' };
  }

  return { needed: false };
}

/**
 * Archives a memory file
 */
export function archiveMemoryFile(agent: string): { success: boolean; archived: boolean; archivePath?: string; reason?: string } {
  const sourcePath = path.join(MEMORY_DIR, `${agent}.md`);

  if (!fs.existsSync(sourcePath)) {
    return { success: false, reason: 'file_not_found' };
  }

  const check = needsArchiving(sourcePath);
  if (!check.needed) {
    return { success: true, archived: false, reason: 'not_needed' };
  }

  const date = new Date();
  const monthDir = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const archiveSubDir = path.join(LOG_DIR, monthDir);

  if (!fs.existsSync(archiveSubDir)) {
    fs.mkdirSync(archiveSubDir, { recursive: true });
  }

  const dateStr = date.toISOString().split('T')[0];
  const archivePath = path.join(archiveSubDir, `${agent}-${dateStr}.md`);

  fs.copyFileSync(sourcePath, archivePath);

  // Truncate original
  truncateMemoryFile(sourcePath, agent);

  return { success: true, archived: true, archivePath };
}

/**
 * Truncates memory file
 */
function truncateMemoryFile(filePath: string, agent: string): void {
  const header = `# ${agent} Agent Memory

## Essential Context
<!-- Preserved context -->

## Learned Patterns
*Archived. See log/ directory for history.*

## Recent Tasks
*Archived. See log/ directory for history.*

## Error Resolutions
*Archived. See log/ directory for history.*
`;

  fs.writeFileSync(filePath, header);
}

/**
 * Archives completed progress files
 */
export function archiveCompletedProgress(): { success: boolean; archived: number } {
  if (!fs.existsSync(PROGRESS_DIR)) {
    return { success: true, archived: 0 };
  }

  const files = fs.readdirSync(PROGRESS_DIR).filter(f => f.endsWith('.md') && !f.startsWith('HANDOFF'));
  const date = new Date();
  const monthDir = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const archiveSubDir = path.join(LOG_DIR, monthDir, 'progress');

  let archived = 0;

  for (const file of files) {
    const filePath = path.join(PROGRESS_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');

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
 * Archives old handoff documents
 */
export function archiveHandoffs(): { success: boolean; archived: number } {
  if (!fs.existsSync(PROGRESS_DIR)) {
    return { success: true, archived: 0 };
  }

  const files = fs.readdirSync(PROGRESS_DIR).filter(f => f.startsWith('HANDOFF_'));
  const date = new Date();
  const monthDir = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const archiveSubDir = path.join(LOG_DIR, monthDir, 'handoffs');

  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days
  let archived = 0;

  for (const file of files) {
    const filePath = path.join(PROGRESS_DIR, file);
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
 */
export function runArchiveCycle(): { timestamp: string; agents: Record<string, { archived: boolean }>; progress: { archived: number }; handoffs: { archived: number } } {
  const agents = ['backend', 'frontend', 'qa', 'review-git'];
  const results: Record<string, { archived: boolean }> = {};

  for (const agent of agents) {
    const result = archiveMemoryFile(agent);
    results[agent] = { archived: result.archived };
  }

  const progressResult = archiveCompletedProgress();
  const handoffsResult = archiveHandoffs();

  return {
    timestamp: new Date().toISOString(),
    agents: results,
    progress: { archived: progressResult.archived },
    handoffs: { archived: handoffsResult.archived }
  };
}

/**
 * Lists archive contents
 */
export function listArchiveContents(): { months: string[]; contents: Record<string, { memories: string[]; progress: string[]; handoffs: string[] }> } {
  if (!fs.existsSync(LOG_DIR)) {
    return { months: [], contents: {} };
  }

  const months = fs.readdirSync(LOG_DIR).filter(d => fs.statSync(path.join(LOG_DIR, d)).isDirectory());
  const contents: Record<string, { memories: string[]; progress: string[]; handoffs: string[] }> = {};

  for (const month of months) {
    const monthPath = path.join(LOG_DIR, month);
    contents[month] = { memories: [], progress: [], handoffs: [] };

    const files = fs.readdirSync(monthPath);
    for (const file of files) {
      const filePath = path.join(monthPath, file);
      if (fs.statSync(filePath).isDirectory()) {
        const subFiles = fs.readdirSync(filePath);
        for (const subFile of subFiles) {
          contents[month][file as keyof typeof contents[typeof month]].push(subFile);
        }
      } else {
        contents[month].memories.push(file);
      }
    }
  }

  return { months, contents };
}
```

**Step 2: Commit**

```bash
git add lib/archive-manager.ts
git commit -m "feat(orchestrator): add archive manager"
```

---

## Task 4.6: Update CLI with Integration Commands

**Files:**
- Modify: `bin/cc-orch.ts`

**Step 1: Add integration commands**

Add these commands to `bin/cc-orch.ts`:

```typescript
// Import integration modules
import { advanceToNextStage, getStageInfo } from '../lib/pipeline-router';
import { notifyBlocked, notifyFailed, notifyComplete } from '../lib/telegram-notifier';
import { spawnAdhocAgent, listAdhocAgents, cleanupIdleAdhocAgents } from '../lib/adhoc-manager';
import { syncAllAgents, syncToEvolutionRegistry } from '../lib/learning-sync';
import { runArchiveCycle, listArchiveContents } from '../lib/archive-manager';

// Add commands:

program.command('advance <taskId> <agent>')
  .description('Advance task to next pipeline stage')
  .action((taskId, agent) => {
    const result = advanceToNextStage(taskId, agent, { status: 'COMPLETE' });
    console.log('Advance result:', result);
  });

program.command('stage-info <agent>')
  .description('Show pipeline stage info for agent')
  .action((agent) => {
    const info = getStageInfo(agent);
    console.log(`Agent: ${info.agent}`);
    console.log(`Position: ${info.index + 1}/${info.total}`);
    console.log(`Previous: ${info.previous || 'none'}`);
    console.log(`Next: ${info.next || 'none (last)'}`);
  });

program.command('adhoc')
  .description('List adhoc agents')
  .action(() => {
    const agents = listAdhocAgents();
    console.log('\n=== Adhoc Agents ===');
    if (agents.length === 0) {
      console.log('None');
    } else {
      agents.forEach(a => {
        console.log(`  ${a.sessionName}: ${a.type} (running: ${a.running})`);
      });
    }
  });

program.command('adhoc-spawn <type>')
  .description('Spawn an adhoc agent')
  .option('-t, --task <id>', 'Task ID')
  .action((type, options) => {
    const result = spawnAdhocAgent(type, { taskId: options.task });
    console.log('Spawn result:', result);
  });

program.command('adhoc-cleanup')
  .description('Cleanup idle adhoc agents')
  .action(() => {
    const result = cleanupIdleAdhocAgents();
    console.log(`Cleaned up ${result.killed} idle adhoc agents`);
  });

program.command('learn')
  .description('Sync learning to Redis')
  .option('-a, --agent <name>', 'Specific agent (all if not specified)')
  .action((options) => {
    if (options.agent) {
      const result = syncToEvolutionRegistry(options.agent);
      console.log(`Synced ${result.synced}/${result.total} learnings from ${options.agent}`);
    } else {
      const result = syncAllAgents();
      console.log(`Synced ${result.totalSynced} total learnings`);
    }
  });

program.command('archive')
  .description('Run archive cycle')
  .action(() => {
    const result = runArchiveCycle();
    console.log('Archive cycle complete:', JSON.stringify(result, null, 2));
  });

program.command('archive-list')
  .description('List archive contents')
  .action(() => {
    const { months, contents } = listArchiveContents();
    console.log('\n=== Archive Contents ===');
    for (const month of months) {
      console.log(`\n${month}:`);
      const data = contents[month];
      if (data.memories?.length) console.log(`  Memories: ${data.memories.length} files`);
      if (data.progress?.length) console.log(`  Progress: ${data.progress.length} files`);
      if (data.handoffs?.length) console.log(`  Handoffs: ${data.handoffs.length} files`);
    }
  });

program.command('notify <type>')
  .description('Send test notification')
  .option('-t, --task <id>', 'Task ID', 'TEST-001')
  .action(async (type, options) => {
    let result;
    switch (type) {
      case 'blocked':
        result = await notifyBlocked({ id: options.task }, 'backend', 'Test block');
        break;
      case 'failed':
        result = await notifyFailed({ id: options.task }, 'backend', 'Test error');
        break;
      case 'complete':
        result = await notifyComplete({ id: options.task }, 'default', '5 minutes');
        break;
      default:
        console.log('Unknown type. Use: blocked, failed, complete');
        return;
    }
    console.log('Notification result:', result);
  });
```

**Step 2: Commit**

```bash
git add bin/cc-orch.ts
git commit -m "feat(orchestrator): add integration commands to CLI"
```

---

## Phase 4 Complete Checklist

- [ ] `lib/pipeline-router.ts` created with tests
- [ ] `lib/telegram-notifier.ts` created
- [ ] `lib/adhoc-manager.ts` created
- [ ] `lib/learning-sync.ts` created
- [ ] `lib/archive-manager.ts` created
- [ ] CLI updated with integration commands

**Next Phase:** Phase 5 - Cleanup (remove old files, move policies, update documentation)
