# Phase 3: Workflow Pipeline - Multi-Agent Orchestrator

> **For Claude:** REQUIRED SUB-SKILL: Use `executing-plans` or `subagent-driven-development` skill to implement this plan task-by-task.
> **Depends on:** Phase 2 - Core Agents

**Goal:** Implement pipeline stage routing, review-git agent integration with confidence scoring, and Telegram notifications for blocked/failed tasks.

**Architecture:** Pipeline stages route through review-git agent for quality gates. Confidence threshold determines auto-advance vs human escalation. Telegram integration notifies on blockers.

**Tech Stack:** Node.js, Telegram Bot API, file-based state

---

## Task 3.1: Create Pipeline Router

**Files:**
- Create: `lib/pipeline_router.cjs`

**Step 1: Write pipeline router**

```javascript
const { getWorkflow } = require('./orchestration_config.cjs');
const { enqueueTask } = require('./queue_manager.cjs');
const {
  createHandoff,
  saveHandoff,
  readHandoff
} = require('./handoff.cjs');

/**
 * Routes a task through the pipeline
 * @param {Object} task - Task to route
 * @returns {Object} Routing result
 */
function routeTask(task) {
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
 * @param {string} taskId - Task ID
 * @param {string} currentAgent - Current agent name
 * @param {Object} result - Task result (status, confidence, etc.)
 * @returns {Object} Advance result
 */
function advanceToNextStage(taskId, currentAgent, result) {
  const workflow = getWorkflow(result.workflow || 'default');
  const pipeline = workflow.pipeline;
  const currentIndex = pipeline.indexOf(currentAgent);

  if (currentIndex === -1) {
    return { success: false, reason: 'agent_not_in_pipeline' };
  }

  if (currentIndex === pipeline.length - 1) {
    // Task complete
    return {
      success: true,
      complete: true,
      message: 'Task completed full pipeline'
    };
  }

  const nextAgent = pipeline[currentIndex + 1];

  // Check confidence threshold if coming from review-git
  if (currentAgent === 'review-git') {
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
    status: result.status || 'COMPLETE',
    confidence: result.confidence || 0.8,
    summary: result.summary || `Completed by ${currentAgent}`,
    filesChanged: result.filesChanged || [],
    learnings: result.learnings || [],
    blockers: result.blockers || 'None',
    recommendations: result.recommendations || []
  });

  const handoffPath = saveHandoff(handoff, taskId, currentAgent, nextAgent);

  // Enqueue for next agent
  const enqueueResult = enqueueTask(nextAgent, {
    id: taskId,
    handoffFrom: currentAgent,
    handoffPath,
    workflow: result.workflow || 'default',
    priority: result.priority || 3
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
 * @param {string} currentAgent - Current agent
 * @param {string} workflowName - Workflow name
 * @returns {string|null} Next agent or null
 */
function getNextAgent(currentAgent, workflowName = 'default') {
  const workflow = getWorkflow(workflowName);
  const pipeline = workflow.pipeline;
  const currentIndex = pipeline.indexOf(currentAgent);

  if (currentIndex === -1 || currentIndex === pipeline.length - 1) {
    return null;
  }

  return pipeline[currentIndex + 1];
}

/**
 * Validates pipeline position
 * @param {string} agent - Agent name
 * @param {string} workflowName - Workflow name
 * @returns {boolean} True if agent is in pipeline
 */
function isInPipeline(agent, workflowName = 'default') {
  const workflow = getWorkflow(workflowName);
  return workflow.pipeline.includes(agent);
}

/**
 * Gets pipeline stage info
 * @param {string} agent - Agent name
 * @param {string} workflowName - Workflow name
 * @returns {Object} Stage info
 */
function getStageInfo(agent, workflowName = 'default') {
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
 * Determines if review is needed before next stage
 * @param {string} currentAgent - Current agent
 * @param {string} workflowName - Workflow name
 * @returns {boolean} True if review is next
 */
function needsReviewBeforeAdvance(currentAgent, workflowName = 'default') {
  const nextAgent = getNextAgent(currentAgent, workflowName);
  return nextAgent === 'review-git';
}

module.exports = {
  routeTask,
  advanceToNextStage,
  getNextAgent,
  isInPipeline,
  getStageInfo,
  needsReviewBeforeAdvance
};
```

**Step 2: Create test file**

Create: `lib/__tests__/pipeline_router.test.js`

```javascript
const {
  routeTask,
  advanceToNextStage,
  getNextAgent,
  getStageInfo,
  needsReviewBeforeAdvance
} = require('../pipeline_router.cjs');

function runTests() {
  console.log('Testing pipeline_router...');

  // Test 1: Route task to first stage
  const route1 = routeTask({ id: 'TEST-001', workflow: 'default' });
  console.assert(route1.success === true, 'Route should succeed');
  console.assert(route1.entryStage === 'backend', 'Should start at backend');
  console.assert(Array.isArray(route1.pipeline), 'Should have pipeline array');
  console.log('✓ Route task to first stage');

  // Test 2: Get next agent
  const next1 = getNextAgent('backend', 'default');
  console.assert(next1 === 'review-git', 'Next after backend should be review-git');

  const next2 = getNextAgent('review-git', 'default');
  console.assert(next2 === 'frontend', 'Next after review-git should be frontend');

  const next3 = getNextAgent('qa', 'default');
  console.assert(next3 === null, 'Next after qa should be null');
  console.log('✓ Get next agent');

  // Test 3: Get stage info
  const info1 = getStageInfo('backend', 'default');
  console.assert(info1.isFirst === true, 'Backend should be first');
  console.assert(info1.isLast === false, 'Backend should not be last');
  console.assert(info1.next === 'review-git', 'Next should be review-git');
  console.log('✓ Get stage info');

  const info2 = getStageInfo('qa', 'default');
  console.assert(info2.isFirst === false, 'QA should not be first');
  console.assert(info2.isLast === true, 'QA should be last');
  console.log('✓ QA is last stage');

  // Test 4: Needs review
  const review1 = needsReviewBeforeAdvance('backend', 'default');
  console.assert(review1 === true, 'Backend should need review before advance');

  const review2 = needsReviewBeforeAdvance('frontend', 'default');
  console.assert(review2 === true, 'Frontend should need review before advance');
  console.log('✓ Needs review before advance');

  // Test 5: Backend-only workflow
  const route2 = routeTask({ id: 'TEST-002', workflow: 'backend_only' });
  console.assert(route2.entryStage === 'backend', 'Should start at backend');
  console.assert(route2.pipeline.length === 3, 'Should have 3 stages');
  console.log('✓ Backend-only workflow');

  console.log('All pipeline_router tests passed!');
}

runTests();
```

**Step 3: Run tests**

Run: `node lib/__tests__/pipeline_router.test.js`
Expected: "All pipeline_router tests passed!"

**Step 4: Commit**

```bash
git add lib/pipeline_router.cjs lib/__tests__/
git commit -m "feat(orchestrator): add pipeline router"
```

---

## Task 3.2: Create Review-Git Agent Integration

**Files:**
- Create: `lib/review_git_agent.cjs`

**Step 1: Write review-git agent module**

```javascript
const { sendToAgent, isAgentRunning } = require('./spawn_agent.cjs');
const {
  readProgressFile,
  updateProgressFile
} = require('./memory_manager.cjs');
const {
  createHandoff,
  saveHandoff
} = require('./handoff.cjs');
const { getWorkflow } = require('./orchestration_config.cjs');

/**
 * Review result structure
 * @typedef {Object} ReviewResult
 * @property {number} confidence - Confidence score (0-1)
 * @property {string[]} issues - List of issues found
 * @property {string[]} suggestions - Improvement suggestions
 * @property {boolean} approved - Whether code passes review
 * @property {string} [commitHash] - Commit hash if approved
 */

/**
 * Submits code for review
 * @param {string} taskId - Task ID
 * @param {string} fromAgent - Agent that completed work
 * @param {Object} workResult - Work result from agent
 * @returns {Object} Review submission result
 */
function submitForReview(taskId, fromAgent, workResult) {
  if (!isAgentRunning('review-git')) {
    return { success: false, reason: 'review_agent_not_running' };
  }

  // Create handoff to review-git
  const handoff = createHandoff({
    from: fromAgent,
    to: 'review-git',
    taskId,
    status: workResult.status || 'COMPLETE',
    confidence: workResult.confidence || 0.8,
    summary: workResult.summary || 'Work submitted for review',
    filesChanged: workResult.filesChanged || [],
    learnings: workResult.learnings || [],
    blockers: 'None',
    recommendations: workResult.recommendations || []
  });

  const handoffPath = saveHandoff(handoff, taskId, fromAgent, 'review-git');

  // Send to review-git agent
  const reviewCommand = `/skill code-reviewer --files ${workResult.filesChanged?.join(',') || 'all'} --task ${taskId}`;
  sendToAgent('review-git', reviewCommand);

  return {
    success: true,
    handoffPath,
    message: 'Submitted for review'
  };
}

/**
 * Parses review output from review-git agent
 * @param {string} taskId - Task ID
 * @returns {ReviewResult|null} Parsed review result
 */
function parseReviewResult(taskId) {
  const progress = readProgressFile('review-git', taskId);

  if (!progress || progress.status !== 'COMPLETE') {
    return null;
  }

  // Parse confidence from progress file
  const content = progress.raw;
  const confidenceMatch = content.match(/confidence[:\s]+([\d.]+)/i);
  const approvedMatch = content.match(/approved[:\s]+(true|false|yes|no)/i);
  const commitMatch = content.match(/commit[:\s]+([a-f0-9]{7,40})/i);

  // Extract issues
  const issuesSection = content.match(/## Issues Found\n([\s\S]*?)(?=## |$)/i);
  const issues = issuesSection
    ? issuesSection[1].trim().split('\n').filter(l => l.startsWith('- ')).map(l => l.slice(2))
    : [];

  // Extract suggestions
  const suggestionsSection = content.match(/## Suggestions\n([\s\S]*?)(?=## |$)/i);
  const suggestions = suggestionsSection
    ? suggestionsSection[1].trim().split('\n').filter(l => l.startsWith('- ')).map(l => l.slice(2))
    : [];

  return {
    confidence: confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.5,
    issues,
    suggestions,
    approved: approvedMatch ? ['true', 'yes'].includes(approvedMatch[1].toLowerCase()) : false,
    commitHash: commitMatch ? commitMatch[1] : null
  };
}

/**
 * Evaluates review result against threshold
 * @param {ReviewResult} review - Review result
 * @param {string} workflowName - Workflow name
 * @returns {Object} Evaluation result
 */
function evaluateReview(review, workflowName = 'default') {
  const workflow = getWorkflow(workflowName);
  const threshold = workflow.review_threshold;

  const passes = review.confidence >= threshold;

  return {
    passes,
    confidence: review.confidence,
    threshold,
    canAutoAdvance: passes && review.approved,
    action: passes && review.approved ? 'advance' : (passes ? 'commit_and_advance' : 'block'),
    issues: review.issues,
    suggestions: review.suggestions,
    commitHash: review.commitHash
  };
}

/**
 * Performs git operations after successful review
 * @param {string} taskId - Task ID
 * @param {string[]} files - Files to commit
 * @param {string} message - Commit message
 * @returns {Object} Git result
 */
async function performGitOperations(taskId, files, message) {
  const { execSync } = require('child_process');

  try {
    // Stage files
    if (files.length > 0) {
      execSync(`git add ${files.join(' ')}`);
    } else {
      execSync('git add -A');
    }

    // Create commit
    const commitMessage = message || `feat: complete ${taskId}`;
    execSync(`git commit -m "${commitMessage}"`);

    // Get commit hash
    const hash = execSync('git rev-parse HEAD').toString().trim().slice(0, 7);

    // Push (optional, based on config)
    // execSync('git push');

    return {
      success: true,
      commitHash: hash,
      message: 'Git operations completed'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Full review workflow
 * @param {string} taskId - Task ID
 * @param {string} fromAgent - Source agent
 * @param {Object} workResult - Work result
 * @param {string} workflowName - Workflow name
 * @returns {Object} Review workflow result
 */
async function performReview(taskId, fromAgent, workResult, workflowName = 'default') {
  // Submit for review
  const submitResult = submitForReview(taskId, fromAgent, workResult);

  if (!submitResult.success) {
    return submitResult;
  }

  // Wait for review to complete (polling)
  // In real implementation, this would be handled by the orchestrator loop
  // For now, return pending status

  return {
    success: true,
    status: 'review_pending',
    handoffPath: submitResult.handoffPath,
    message: 'Review submitted, waiting for completion'
  };
}

module.exports = {
  submitForReview,
  parseReviewResult,
  evaluateReview,
  performGitOperations,
  performReview
};
```

**Step 2: Create test file**

Create: `lib/__tests__/review_git_agent.test.js`

```javascript
const {
  evaluateReview,
  performGitOperations
} = require('../review_git_agent.cjs');

function runTests() {
  console.log('Testing review_git_agent...');

  // Test 1: Evaluate high confidence review
  const review1 = {
    confidence: 0.9,
    issues: [],
    suggestions: ['Consider adding tests'],
    approved: true,
    commitHash: null
  };

  const eval1 = evaluateReview(review1, 'default');
  console.assert(eval1.passes === true, 'High confidence should pass');
  console.assert(eval1.canAutoAdvance === true, 'Should auto-advance');
  console.assert(eval1.action === 'advance', 'Action should be advance');
  console.log('✓ Evaluate high confidence review');

  // Test 2: Evaluate low confidence review
  const review2 = {
    confidence: 0.5,
    issues: ['Missing error handling'],
    suggestions: [],
    approved: false,
    commitHash: null
  };

  const eval2 = evaluateReview(review2, 'default');
  console.assert(eval2.passes === false, 'Low confidence should not pass');
  console.assert(eval2.action === 'block', 'Action should be block');
  console.log('✓ Evaluate low confidence review');

  // Test 3: Evaluate medium confidence with approval
  const review3 = {
    confidence: 0.85,
    issues: [],
    suggestions: [],
    approved: true,
    commitHash: 'abc1234'
  };

  const eval3 = evaluateReview(review3, 'default');
  console.assert(eval3.passes === true, 'Should pass threshold');
  console.assert(eval3.canAutoAdvance === true, 'Should auto-advance');
  console.assert(eval3.commitHash === 'abc1234', 'Should have commit hash');
  console.log('✓ Evaluate medium confidence with approval');

  // Test 4: Different workflow threshold
  const eval4 = evaluateReview(review1, 'backend_only'); // 0.85 threshold
  console.assert(eval4.threshold === 0.85, 'Should use backend_only threshold');
  console.log('✓ Different workflow threshold');

  console.log('All review_git_agent tests passed!');
}

runTests();
```

**Step 3: Run tests**

Run: `node lib/__tests__/review_git_agent.test.js`
Expected: "All review_git_agent tests passed!"

**Step 4: Commit**

```bash
git add lib/review_git_agent.cjs lib/__tests__/
git commit -m "feat(orchestrator): add review-git agent integration"
```

---

## Task 3.3: Create Telegram Notifier

**Files:**
- Create: `lib/telegram_notifier.cjs`

**Step 1: Write Telegram notifier**

```javascript
const https = require('https');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const BOTS_CONFIG_PATH = path.join(__dirname, '..', 'config', 'bots.yaml');

let botConfig = null;

/**
 * Loads bot configuration
 */
function loadBotConfig() {
  if (botConfig) return botConfig;

  if (!fs.existsSync(BOTS_CONFIG_PATH)) {
    console.warn('bots.yaml not found, Telegram notifications disabled');
    return null;
  }

  const content = fs.readFileSync(BOTS_CONFIG_PATH, 'utf-8');
  const config = yaml.load(content);

  // Find primary orchestrator bot
  botConfig = config.bots?.find(b => b.role === 'primary_orchestrator');
  return botConfig;
}

/**
 * Sends a Telegram message
 * @param {string} chatId - Target chat ID
 * @param {string} text - Message text (Markdown supported)
 * @param {Object} options - Additional options
 */
async function sendMessage(chatId, text, options = {}) {
  const config = loadBotConfig();

  if (!config || !config.token) {
    console.log('[Telegram] Not configured, skipping message');
    return { success: false, reason: 'not_configured' };
  }

  const body = JSON.stringify({
    chat_id: chatId,
    text: text,
    parse_mode: options.parseMode || 'Markdown',
    disable_notification: options.silent || false
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${config.token}/sendMessage`,
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
          resolve({ success: false, error: e.message });
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
 * @param {Object} task - Task details
 * @param {string} reason - Block reason
 */
async function notifyBlocked(task, reason) {
  const config = loadBotConfig();
  const adminChat = config?.permissions?.admin_users?.[0];

  if (!adminChat) {
    console.log('[Telegram] No admin chat configured');
    return { success: false };
  }

  const text = `⚠️ *Task Blocked*

**Task:** \`${task.id}\`
**Agent:** ${task.agent}
**Reason:** ${reason}
**Time:** ${new Date().toISOString()}

Action required: Review and decide to retry, reassign, or abort.`;

  return sendMessage(adminChat, text);
}

/**
 * Notifies about failed task
 * @param {Object} task - Task details
 * @param {string} error - Error message
 */
async function notifyFailed(task, error) {
  const config = loadBotConfig();
  const adminChat = config?.permissions?.admin_users?.[0];

  if (!adminChat) return { success: false };

  const text = `❌ *Task Failed*

**Task:** \`${task.id}\`
**Agent:** ${task.agent}
**Error:** ${error}
**Time:** ${new Date().toISOString()}

Retries exhausted. Manual intervention required.`;

  return sendMessage(adminChat, text);
}

/**
 * Notifies about agent assignment conflict
 * @param {Object} task - Task details
 * @param {Object} conflict - Conflict info
 */
async function notifyAgentConflict(task, conflict) {
  const config = loadBotConfig();
  const adminChat = config?.permissions?.admin_users?.[0];

  if (!adminChat) return { success: false };

  const text = `⚠️ *Agent Assignment Conflict*

**Task:** \`${task.id}\`
**Needs:** ${conflict.agentType}-agent
**Status:** OCCUPIED by ${conflict.occupiedBy}
**Queue:** ${conflict.queueLength} task(s) ahead (~${conflict.estimatedWait} min wait)

Options:
[A] Wait in queue
[B] Spawn adhoc agent (uses extra resources)`;

  return sendMessage(adminChat, text);
}

/**
 * Notifies about review rejection
 * @param {Object} task - Task details
 * @param {Object} review - Review result
 */
async function notifyReviewRejected(task, review) {
  const config = loadBotConfig();
  const adminChat = config?.permissions?.admin_users?.[0];

  if (!adminChat) return { success: false };

  const issues = review.issues.map(i => `  • ${i}`).join('\n');

  const text = `🔍 *Review Rejected*

**Task:** \`${task.id}\`
**Confidence:** ${review.confidence} (threshold: ${review.threshold})

**Issues Found:**
${issues}

Action: Code needs revision before proceeding.`;

  return sendMessage(adminChat, text);
}

/**
 * Notifies about task completion
 * @param {Object} task - Task details
 */
async function notifyComplete(task) {
  const config = loadBotConfig();
  const adminChat = config?.permissions?.admin_users?.[0];

  if (!adminChat) return { success: false };

  const text = `✅ *Task Complete*

**Task:** \`${task.id}\`
**Pipeline:** ${task.workflow || 'default'}
**Duration:** ${task.duration || 'unknown'}
**Time:** ${new Date().toISOString()}

All pipeline stages completed successfully.`;

  return sendMessage(adminChat, text);
}

/**
 * Notifies about new task queued
 * @param {Object} task - Task details
 * @param {string} agent - Target agent
 * @param {number} position - Queue position
 */
async function notifyTaskQueued(task, agent, position) {
  const config = loadBotConfig();
  const adminChat = config?.permissions?.admin_users?.[0];

  if (!adminChat) return { success: false };

  const text = `📥 *Task Queued*

**Task:** \`${task.id}\`
**Agent:** ${agent}
**Queue Position:** ${position}
**Estimated Wait:** ~${position * 5} minutes`;

  return sendMessage(adminChat, text);
}

module.exports = {
  sendMessage,
  notifyBlocked,
  notifyFailed,
  notifyAgentConflict,
  notifyReviewRejected,
  notifyComplete,
  notifyTaskQueued
};
```

**Step 2: Create test file**

Create: `lib/__tests__/telegram_notifier.test.js`

```javascript
const {
  sendMessage,
  notifyBlocked,
  notifyFailed,
  notifyComplete
} = require('../telegram_notifier.cjs');

function runTests() {
  console.log('Testing telegram_notifier...');

  // Note: These tests don't actually send messages (no bots.yaml)
  // They test the message formatting logic

  // Test 1: sendMessage without config
  const result1 = sendMessage('123', 'Test message');
  console.assert(result1.success === false, 'Should fail without config');
  console.log('✓ sendMessage fails gracefully without config');

  // Test 2: notifyBlocked without config
  const result2 = notifyBlocked({ id: 'TEST-001', agent: 'backend' }, 'Test reason');
  console.assert(result2.success === false, 'Should fail without config');
  console.log('✓ notifyBlocked fails gracefully');

  // Test 3: notifyFailed without config
  const result3 = notifyFailed({ id: 'TEST-001', agent: 'backend' }, 'Test error');
  console.assert(result3.success === false, 'Should fail without config');
  console.log('✓ notifyFailed fails gracefully');

  // Test 4: notifyComplete without config
  const result4 = notifyComplete({ id: 'TEST-001', workflow: 'default' });
  console.assert(result4.success === false, 'Should fail without config');
  console.log('✓ notifyComplete fails gracefully');

  console.log('All telegram_notifier tests passed!');
  console.log('Note: Full tests require bots.yaml configuration');
}

runTests();
```

**Step 3: Run tests**

Run: `node lib/__tests__/telegram_notifier.test.js`
Expected: "All telegram_notifier tests passed!"

**Step 4: Commit**

```bash
git add lib/telegram_notifier.cjs lib/__tests__/
git commit -m "feat(orchestrator): add Telegram notification system"
```

---

## Task 3.4: Integrate Notifications with Orchestrator

**Files:**
- Modify: `lib/orchestrator.cjs`

**Step 1: Update orchestrator with notifications**

Add to the imports section:

```javascript
const {
  notifyBlocked,
  notifyFailed,
  notifyComplete,
  notifyAgentConflict,
  notifyReviewRejected,
  notifyTaskQueued
} = require('./telegram_notifier.cjs');

const {
  evaluateReview,
  parseReviewResult
} = require('./review_git_agent.cjs');

const {
  advanceToNextStage,
  needsReviewBeforeAdvance
} = require('./pipeline_router.cjs');
```

**Step 2: Update handleTaskComplete**

Replace the existing `handleTaskComplete` function:

```javascript
/**
 * Handles task completion
 */
async function handleTaskComplete(taskId, taskInfo) {
  console.log(`[Orchestrator] Task ${taskId} completed by ${taskInfo.agent}`);

  // Check if review is needed
  if (taskInfo.agent === 'review-git') {
    // Parse review result
    const reviewResult = parseReviewResult(taskId);

    if (reviewResult) {
      const evaluation = evaluateReview(reviewResult, taskInfo.workflow || 'default');

      if (!evaluation.passes) {
        // Review failed
        await notifyReviewRejected({ id: taskId, ...taskInfo }, evaluation);

        // Update progress
        updateProgressFile('review-git', taskId, {
          status: 'BLOCKED',
          log: `Review failed with confidence ${evaluation.confidence} < ${evaluation.threshold}`
        });

        return;
      }
    }
  }

  // Advance to next stage
  const advanceResult = advanceToNextStage(taskId, taskInfo.agent, {
    status: 'COMPLETE',
    confidence: taskInfo.confidence || 0.8,
    workflow: taskInfo.workflow,
    filesChanged: taskInfo.filesChanged || [],
    learnings: taskInfo.learnings || [],
    summary: taskInfo.summary || `Completed by ${taskInfo.agent}`
  });

  if (advanceResult.success) {
    if (advanceResult.complete) {
      // Task fully complete
      console.log(`[Orchestrator] Task ${taskId} fully complete!`);
      await notifyComplete({
        id: taskId,
        workflow: taskInfo.workflow,
        duration: calculateDuration(taskInfo.started)
      });
    } else {
      // Queued for next agent
      console.log(`[Orchestrator] Queued ${taskId} for ${advanceResult.nextAgent}`);
      await notifyTaskQueued({ id: taskId }, advanceResult.nextAgent, advanceResult.queuePosition);
    }
  } else if (advanceResult.reason === 'confidence_below_threshold') {
    // Block and notify
    await notifyBlocked({ id: taskId, ...taskInfo }, `Confidence ${advanceResult.confidence} below threshold ${advanceResult.threshold}`);
  } else if (advanceResult.reason === 'queue_full') {
    // Agent conflict
    await notifyAgentConflict({ id: taskId }, {
      agentType: advanceResult.nextAgent,
      occupiedBy: 'unknown',
      queueLength: advanceResult.queuePosition || 0,
      estimatedWait: 15
    });
  }

  // Remove from active
  state.activeTasks.delete(taskId);
}

/**
 * Helper: Calculate duration
 */
function calculateDuration(started) {
  if (!started) return 'unknown';
  const start = new Date(started);
  const end = new Date();
  const diff = end - start;
  const minutes = Math.floor(diff / 60000);
  return `${minutes} minutes`;
}
```

**Step 3: Update handleTaskBlocked and handleTaskFailed**

```javascript
/**
 * Handles blocked task
 */
async function handleTaskBlocked(taskId, taskInfo) {
  console.log(`[Orchestrator] Task ${taskId} blocked by ${taskInfo.agent}`);

  const workflow = getWorkflow(taskInfo.workflow || 'default');
  const retries = taskInfo.retries || 0;

  if (retries < workflow.max_retries) {
    // Retry with exponential backoff
    const delay = workflow.retry_backoff_base_ms * Math.pow(2, retries);
    console.log(`[Orchestrator] Retrying in ${delay}ms (attempt ${retries + 1}/${workflow.max_retries})`);

    taskInfo.retries = retries + 1;
    taskInfo.retryAt = Date.now() + delay;

    // Update progress
    updateProgressFile(taskInfo.agent, taskId, {
      log: `Retry scheduled in ${delay}ms (attempt ${retries + 1})`
    });
  } else {
    // Escalate
    await notifyBlocked({ id: taskId, ...taskInfo }, 'Max retries exhausted');
  }
}

/**
 * Handles failed task
 */
async function handleTaskFailed(taskId, taskInfo) {
  console.log(`[Orchestrator] Task ${taskId} failed by ${taskInfo.agent}`);

  await notifyFailed({ id: taskId, ...taskInfo }, taskInfo.error || 'Unknown error');

  // Remove from active
  state.activeTasks.delete(taskId);
}
```

**Step 4: Commit**

```bash
git add lib/orchestrator.cjs
git commit -m "feat(orchestrator): integrate notifications and pipeline routing"
```

---

## Task 3.5: Update Orchestrator CLI with Pipeline Commands

**Files:**
- Modify: `bin/orchestrator.js`

**Step 1: Add pipeline commands**

Add these commands to the CLI:

```javascript
program.command('review <taskId>')
  .description('Submit task for review')
  .option('-a, --agent <agent>', 'Agent that completed work', 'backend')
  .action(async (taskId, options) => {
    const { performReview } = require('../lib/review_git_agent.cjs');
    const result = await performReview(taskId, options.agent, {
      status: 'COMPLETE',
      confidence: 0.8
    });
    console.log('Review result:', result);
  });

program.command('advance <taskId> <agent>')
  .description('Advance task to next pipeline stage')
  .action((taskId, agent) => {
    const { advanceToNextStage } = require('../lib/pipeline_router.cjs');
    const result = advanceToNextStage(taskId, agent, { status: 'COMPLETE' });
    console.log('Advance result:', result);
  });

program.command('workflow <name>')
  .description('Show workflow configuration')
  .action((name) => {
    const { getWorkflow } = require('../lib/orchestration_config.cjs');
    const workflow = getWorkflow(name);
    console.log(`Workflow: ${name}`);
    console.log('Pipeline:', workflow.pipeline.join(' → '));
    console.log('Review threshold:', workflow.review_threshold);
    console.log('Max retries:', workflow.max_retries);
  });

program.command('notify <type>')
  .description('Send test notification')
  .option('-t, --task <id>', 'Task ID', 'TEST-001')
  .action(async (type, options) => {
    const {
      notifyBlocked,
      notifyFailed,
      notifyComplete
    } = require('../lib/telegram_notifier.cjs');

    let result;
    switch (type) {
      case 'blocked':
        result = await notifyBlocked({ id: options.task, agent: 'backend' }, 'Test block');
        break;
      case 'failed':
        result = await notifyFailed({ id: options.task, agent: 'backend' }, 'Test error');
        break;
      case 'complete':
        result = await notifyComplete({ id: options.task, workflow: 'default' });
        break;
      default:
        console.log('Unknown notification type. Use: blocked, failed, complete');
        return;
    }
    console.log('Notification result:', result);
  });
```

**Step 2: Commit**

```bash
git add bin/orchestrator.js
git commit -m "feat(orchestrator): add pipeline and notification CLI commands"
```

---

## Phase 3 Complete Checklist

- [ ] Pipeline router created
- [ ] Review-git agent integration created
- [ ] Telegram notification system created
- [ ] Notifications integrated with orchestrator
- [ ] CLI updated with pipeline commands

**Next Phase:** Phase 4 - Queuing & Learning (adhoc spawning, learning sync, archive system)
