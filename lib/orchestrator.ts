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
  STATUS_IN_PROGRESS,
  STATUS_COMPLETE,
  STATUS_ISSUES_FOUND,
  STATUS_FAILED,
  STATUS_BLOCKED
} from './status-constants.js';

import {
  createHandoff,
  saveHandoff,
  readHandoff
} from './handoff';

import {
  loadConfig,
  getWorkflow,
  getLimits,
  getOrchestratorSettings,
  getBotByRole
} from './orchestration-config';
import { getReferencedSkills } from './role-loader.js';

import { injectTmuxCommand, TmuxTarget } from './tmux';
import Redis from 'ioredis';

/**
 * Orchestrator hook event types
 */
export type OrchestratorEvent =
  | 'task_assigned'      // Agent assigned to task
  | 'task_complete'      // Task fully complete
  | 'task_transition'    // Task moving from one agent to another
  | 'task_revision'      // Task sent back for revision
  | 'task_failed'        // Task failed
  | 'git_decision';      // Git decision notification

export interface OrchestratorHookPayload {
  event: OrchestratorEvent;
  taskId: string;
  agent?: string;
  nextAgent?: string;
  previousAgent?: string;
  details?: string;
  timestamp: number;
}

export type OrchestratorHook = (payload: OrchestratorHookPayload) => Promise<void> | void;

// Registered hooks
const orchestratorHooks: OrchestratorHook[] = [];

/**
 * Register a hook for orchestrator events
 */
export function registerHook(hook: OrchestratorHook): void {
  orchestratorHooks.push(hook);
}

/**
 * Trigger hooks for an event
 */
async function triggerHooks(event: OrchestratorEvent, data: Omit<OrchestratorHookPayload, 'event' | 'timestamp'>): Promise<void> {
  const payload: OrchestratorHookPayload = {
    event,
    ...data,
    timestamp: Date.now()
  };

  for (const hook of orchestratorHooks) {
    try {
      await hook(payload);
    } catch (error) {
      console.error(`[Orchestrator] Hook error for ${event}:`, error);
    }
  }
}

/**
 * Default notification hook - sends Telegram notifications for orchestrator events
 */
function registerDefaultNotificationHook(): void {
  registerHook(async (payload: OrchestratorHookPayload) => {
    const orchestratorBot = getBotByRole('orchestrator');
    const adminChat = orchestratorBot?.permissions?.admin_users?.[0];

    if (!adminChat) {
      console.warn('[Orchestrator] No admin chat configured for notifications');
      return;
    }

    let text = '';
    switch (payload.event) {
      case 'task_assigned':
        text = `🔧 ${payload.agent} assigned to ${payload.taskId}`;
        break;
      case 'task_complete':
        text = `✅ ${payload.taskId} complete!`;
        break;
      case 'task_transition':
        text = `📤 ${payload.taskId}: ${payload.agent} → ${payload.nextAgent}`;
        break;
      case 'task_revision':
        text = `🔄 ${payload.taskId}: ${payload.agent} → ${payload.previousAgent} (revision needed)`;
        break;
      case 'task_failed':
        text = `❌ ${payload.taskId} failed\n\nAgent: ${payload.agent}\nError: ${payload.details || 'Unknown error'}\n\nManual intervention required.`;
        break;
      case 'git_decision':
        text = `✅ ${payload.taskId} fully complete!`;
        break;
    }

    if (text) {
      await sendNotification(text);
    }
  });
}

// Bot routing map: botId -> { tmux session, inject command }
const BOT_ROUTING: Record<string, { session: string; command: string }> = {
  'pichu': { session: 'cc-orchestrator', command: '/commander' },
  'pikachu': { session: 'cc-backend', command: '/backend-handler' },
  'raichu': { session: 'cc-frontend', command: '/frontend-handler' },
  'bulbasaur': { session: 'cc-qa', command: '/qa-handler' },
  'charmander': { session: 'cc-review-git', command: '/review-git-handler' },
};

// Global Redis client for Telegram pub/sub
let redisClient: Redis | null = null;

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

  // Register default notification hook
  registerDefaultNotificationHook();

  // Ensure core agents are running
  for (const agent of getCoreAgents()) {
    if (!isAgentRunning(agent)) {
      console.log(`[Orchestrator] Spawning ${agent} agent...`);
      const botConfig = getBotByRole(agent);
      const roleSkill = botConfig?.agent_config?.role_skill;

      spawnAgent({
        name: agent,
        persona: botConfig?.agent_config?.persona,
        role: roleSkill,
        memoryFile: botConfig?.agent_config?.memory,
        model: 'sonnet'
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

  // Initialize Redis client for Telegram pub/sub
  redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

  // Create consumer groups for each bot's inbox stream
  for (const botId of Object.keys(BOT_ROUTING)) {
    const streamKey = `tg:inbox:${botId}`;
    const groupName = `orchestrator-${botId}`;
    try {
      await redisClient.xgroup('CREATE', streamKey, groupName, '$', 'MKSTREAM');
      console.log(`[Orchestrator] Created Redis consumer group: ${groupName} for ${streamKey}`);
    } catch (e: any) {
      if (!e.message.includes('BUSYGROUP')) {
        console.error(`[Orchestrator] Consumer group creation error for ${botId}:`, e.message);
      }
    }
  }

  // Subscribe to notification channel for instant routing
  const subscriber = redisClient.duplicate();
  await subscriber.subscribe('tg:notify');

  subscriber.on('message', async (channel, message) => {
    if (channel !== 'tg:notify') return;

    try {
      const notification = JSON.parse(message);
      await routeMessageToAgent(notification);
    } catch (error) {
      console.error('[Orchestrator] Notification handling error:', error);
    }
  });

  console.log('[Orchestrator] Subscribed to tg:notify for instant message routing');

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

  // Cleanup
  await subscriber.unsubscribe();
  await subscriber.quit();
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

/**
 * Routes a message from Telegram to the correct agent via tmux injection
 */
async function routeMessageToAgent(notification: { botId: string; chatId: number; messageId: string; timestamp: number }): Promise<void> {
  const { botId, chatId, messageId } = notification;

  if (!redisClient) {
    console.error('[Orchestrator] Redis client not initialized');
    return;
  }

  const routing = BOT_ROUTING[botId];
  if (!routing) {
    console.warn(`[Orchestrator] No routing configured for bot: ${botId}`);
    return;
  }

  console.log(`[Orchestrator] Routing message for ${botId} to ${routing.session}`);

  // Read the message from bot-specific stream
  const streamKey = `tg:inbox:${botId}`;
  const groupName = `orchestrator-${botId}`;
  const consumerName = `orchestrator-${Date.now()}`;

  try {
    const results = await redisClient.call(
      'XREADGROUP',
      'GROUP',
      groupName,
      consumerName,
      'COUNT',
      '1',
      'STREAMS',
      streamKey,
      messageId
    ) as any;

    if (!results || results.length === 0) {
      console.log(`[Orchestrator] No message found at ${messageId} in ${streamKey}`);
      return;
    }

    // Parse the message
    const streamResult = results[0] as unknown[];
    const messages = streamResult[1] as unknown[];
    const messageData = messages[0] as unknown[];
    const inboxId = String(messageData[0]);
    const fields: Record<string, string> = {};
    const fieldPairs = messageData[1] as unknown[];
    if (Array.isArray(fieldPairs)) {
      for (let i = 0; i < fieldPairs.length; i += 2) {
        fields[String(fieldPairs[i])] = String(fieldPairs[i + 1]);
      }
    }

    const text = fields.text || '';
    const userId = fields.user_id || fields.userId || 'unknown';
    const username = fields.username;
    const chatType = fields.chat_type || 'private';
    const replyTo = fields.reply_to ? parseInt(fields.reply_to) : undefined;

    // Store message context in Redis for telegram-reply skill to use
    // Format: tg:inbox:context:{botId} (botId is used as sessionId)
    const contextKey = `tg:inbox:context:${botId}`;
    const context = {
      messageId: inboxId,
      botId,
      chatId,
      userId,
      text,
      username,
      chatType,
      replyTo,
    };
    await redisClient.setex(contextKey, 3600, JSON.stringify(context)); // 1 hour TTL

    // Inject to agent's tmux session
    const escapedText = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const injectCmd = `${routing.command} --message "${escapedText}"`;

    await injectTmuxCommand(
      { session: routing.session, window: 0, pane: 0 },
      injectCmd
    );

    console.log(`[Orchestrator] Injected message to ${routing.session}`);

    // Acknowledge the message
    await redisClient.xack(streamKey, groupName, inboxId);
  } catch (error) {
    console.error(`[Orchestrator] Error routing message for ${botId}:`, error);
  }
}

/**
 * Checks entry points for new tasks
 */
async function checkEntryPoints(): Promise<void> {
  // Check each agent's queue for new tasks
  for (const agent of getCoreAgents()) {
    const queueLength = getQueueLength(agent);

    if (queueLength > 0) {
      // Check if agent is busy
      const busyWithTask = [...state.activeTasks.values()].find(t => t.agent === agent);

      if (!busyWithTask) {
        const task = dequeueTask(agent);

        if (task) {
          await assignTask(agent, task);
        }
      }
    }
  }
}

/**
 * Assigns a task to an agent
 */
async function assignTask(agent: string, task: { id: string; planPath?: string; handoffPath?: string; workflow?: string }): Promise<void> {
  // Validate task has required id field
  if (!task.id) {
    console.error('[Orchestrator] Task missing id field:', JSON.stringify(task));
    return;
  }

  const sessionName = `cc-${agent}`;
  const config = loadConfig();
  const botConfig = getBotByRole(agent);

  console.log(`[Orchestrator] Assigning ${task.id} to ${agent}`);

  // Create progress file
  createProgressFile(agent, task.id, {
    description: task.planPath || task.handoffPath || `Task ${task.id}`
  });

  // Track as active
  state.activeTasks.set(task.id, {
    agent,
    status: 'IN_PROGRESS',
    started: new Date().toISOString(),
    workflow: task.workflow
  });

  // Build injection command (always use --auto for automated pipeline)
  let injectCmd = '';
  if (task.handoffPath) {
    injectCmd = `/plan-execute --auto --handoff ${task.handoffPath}`;
  } else if (task.planPath) {
    injectCmd = `/plan-execute --auto --plan ${task.planPath}`;
  } else {
    injectCmd = `/plan-execute --auto --task ${task.id}`;
  }

  // Inject task to agent tmux
  try {
    await injectTmuxCommand(
      { session: sessionName, window: 0, pane: 0 },
      injectCmd
    );
  } catch (error) {
    console.error(`[Orchestrator] Failed to inject to ${sessionName}:`, error);
    return;
  }

  // Trigger task_assigned hook
  await triggerHooks('task_assigned', {
    taskId: task.id,
    agent
  });
}

/**
 * Sends a notification via gateway /reply endpoint
 */
async function sendNotification(text: string): Promise<void> {
  const orchestratorBot = getBotByRole('orchestrator');
  const adminChat = orchestratorBot?.permissions?.admin_users?.[0];

  if (!adminChat) {
    console.warn('[Orchestrator] No admin chat configured for notifications');
    return;
  }

  try {
    const response = await fetch('http://localhost:3100/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bot_id: 'pichu',
        chat_id: adminChat,
        text
      })
    });

    if (!response.ok) {
      console.error('[Orchestrator] Failed to send notification:', await response.text());
    }
  } catch (error) {
    console.error('[Orchestrator] Notification error:', error);
  }
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

    if (progress.status === STATUS_COMPLETE) {
      await handleTaskComplete(taskId, taskInfo);
    } else if (progress.status === STATUS_ISSUES_FOUND) {
      await handleIssuesFound(taskId, taskInfo);
    } else if (progress.status === STATUS_BLOCKED) {
      console.log(`[Orchestrator] Task ${taskId} blocked`);
    } else if (progress.status === STATUS_FAILED) {
      await handleTaskFailed(taskId, taskInfo);
    }
  }
}

/**
 * Handles task completion
 */
async function handleTaskComplete(taskId: string, taskInfo: { agent: string; workflow?: string }): Promise<void> {
  console.log(`[Orchestrator] Task ${taskId} completed by ${taskInfo.agent}`);

  // Special case: git-decision task complete → mark original task as fully complete
  if (taskId.endsWith('-git-decision')) {
    const originalTaskId = taskId.replace('-git-decision', '');
    console.log(`[Orchestrator] Git decision complete for ${originalTaskId}`);
    console.log(`[Orchestrator] Task ${originalTaskId} fully complete!`);

    // Trigger git_decision hook
    await triggerHooks('git_decision', {
      taskId: originalTaskId,
      agent: taskInfo.agent
    });

    // Trigger task_complete hook
    await triggerHooks('task_complete', {
      taskId: originalTaskId,
      agent: taskInfo.agent
    });

    state.activeTasks.delete(taskId);
    return;
  }

  const workflow = getWorkflow(taskInfo.workflow || 'default');
  const currentIndex = workflow.pipeline.indexOf(taskInfo.agent);

  if (currentIndex === -1 || currentIndex === workflow.pipeline.length - 1) {
    // Task fully complete
    console.log(`[Orchestrator] Task ${taskId} fully complete!`);

    // Trigger task_complete hook
    await triggerHooks('task_complete', {
      taskId,
      agent: taskInfo.agent
    });

    state.activeTasks.delete(taskId);
    return;
  }

  const nextAgent = workflow.pipeline[currentIndex + 1];

  // Special case: QA complete → notify charmander for git decision
  if (taskInfo.agent === 'qa' && nextAgent === 'review-git') {
    await notifyCharmanderForGitOps(taskId, taskInfo);
    state.activeTasks.delete(taskId);
    return;
  }

  // Create handoff
  const handoff = createHandoff({
    from: taskInfo.agent,
    to: nextAgent,
    taskId,
    status: STATUS_COMPLETE,
    confidence: 0.8,
    summary: `Completed by ${taskInfo.agent}`
  });

  const handoffPath = saveHandoff(handoff, taskId, taskInfo.agent, nextAgent);

  // Enqueue for next agent
  const enqueueResult = enqueueTask(nextAgent, {
    id: taskId,
    handoffPath
  });

  if (enqueueResult.success) {
    console.log(`[Orchestrator] Queued ${taskId} for ${nextAgent}`);

    // Trigger task_transition hook
    await triggerHooks('task_transition', {
      taskId,
      agent: taskInfo.agent,
      nextAgent
    });
  }

  state.activeTasks.delete(taskId);
}

/**
 * Handles issues found by QA
 */
async function handleIssuesFound(taskId: string, taskInfo: { agent: string; workflow?: string }): Promise<void> {
  console.log(`[Orchestrator] Task ${taskId} has issues, routing back for revision`);

  const workflow = getWorkflow(taskInfo.workflow || 'default');
  const currentIndex = workflow.pipeline.indexOf(taskInfo.agent);

  if (currentIndex === -1 || currentIndex === 0) {
    // Can't route back - no previous agent
    console.error(`[Orchestrator] Task ${taskId} has issues but no previous agent to route to`);
    await sendNotification(`⚠️ ${taskId}: ${taskInfo.agent} found issues but no previous agent to route to. Manual intervention required.`);
    state.activeTasks.delete(taskId);
    return;
  }

  const previousAgent = workflow.pipeline[currentIndex - 1];

  // Create handoff back to previous agent
  const handoff = createHandoff({
    from: taskInfo.agent,
    to: previousAgent,
    taskId,
    status: STATUS_ISSUES_FOUND,
    confidence: 0,
    summary: `Revision required - ${taskInfo.agent} found issues`
  });

  const handoffPath = saveHandoff(handoff, taskId, taskInfo.agent, previousAgent);

  // Enqueue for previous agent
  const enqueueResult = enqueueTask(previousAgent, {
    id: taskId,
    handoffPath,
    workflow: taskInfo.workflow
  });

  if (enqueueResult.success) {
    console.log(`[Orchestrator] Routed ${taskId} back to ${previousAgent} for revision`);

    // Trigger task_revision hook
    await triggerHooks('task_revision', {
      taskId,
      agent: taskInfo.agent,
      previousAgent
    });
  }

  state.activeTasks.delete(taskId);
}

/**
 * Handles task failure
 */
async function handleTaskFailed(taskId: string, taskInfo: { agent: string; workflow?: string }): Promise<void> {
  console.log(`[Orchestrator] Task ${taskId} failed`);

  const progress = readProgressFile(taskInfo.agent, taskId);
  const errorInfo = progress?.raw.match(/## Error\n\n(.+?)\n\n/)?.[1] || 'Unknown error';

  // Trigger task_failed hook
  await triggerHooks('task_failed', {
    taskId,
    agent: taskInfo.agent,
    details: errorInfo
  });

  state.activeTasks.delete(taskId);
}

/**
 * Notifies charmander for git operations after QA passes
 */
async function notifyCharmanderForGitOps(taskId: string, taskInfo: { agent: string; workflow?: string }): Promise<void> {
  console.log(`[Orchestrator] Notifying charmander for git ops on ${taskId}`);

  // Read progress file from the agent that just completed
  const progress = readProgressFile(taskInfo.agent, taskId);

  if (!progress) {
    console.error(`[Orchestrator] No progress file for ${taskId} (agent: ${taskInfo.agent})`);
    return;
  }

  // Parse fields from raw content
  const raw = progress.raw;

  // Extract summary from Summary section (multiline support)
  const summaryMatch = raw.match(/## Summary\n\n([\s\S]+?)(?=\n\n##|$)/);
  const summary = summaryMatch ? summaryMatch[1].trim() : 'Task completed';

  // Extract files changed from Files Changed section
  const filesChangedSection = raw.match(/## Files Changed\n\n([\s\S]+?)(?=\n\n##|$)/);
  const filesChanged: string[] = [];
  if (filesChangedSection) {
    const content = filesChangedSection[1].trim();
    // Skip if it says "None" or similar
    if (!content.toLowerCase().startsWith('none') && content !== '-') {
      const lines = content.split('\n');
      for (const line of lines) {
        // Try to match various markdown list formats
        // Format 1: - `filename`
        let match = line.match(/^-\s+`([^`]+)`/);
        if (match) {
          filesChanged.push(match[1].trim());
          continue;
        }
        // Format 2: - **filename**
        match = line.match(/^-\s+\*\*([^*]+)\*\*/);
        if (match) {
          filesChanged.push(match[1].trim());
          continue;
        }
        // Format 3: - filename* (with trailing asterisk)
        match = line.match(/^-\s+(\S+)\*/);
        if (match) {
          filesChanged.push(match[1].trim());
          continue;
        }
        // Format 4: - filename (plain)
        match = line.match(/^-\s+(.+)/);
        if (match) {
          const filename = match[1].trim().replace(/^`+|`+$/g, '').replace(/^\*\*+|\*\*+$/g, '');
          if (filename && !filename.toLowerCase().startsWith('none')) {
            filesChanged.push(filename);
          }
        }
      }
    }
  }

  // Extract test results from Verification section (flexible header matching)
  const verificationSection = raw.match(/## Verification[^\n]*\n\n([\s\S]+?)(?=\n\n##|$)/);
  const testResults = verificationSection ? verificationSection[1].trim() : 'No test results';

  // Format files list
  const filesList = filesChanged.map((f: string) => `  • ${f}`).join('\n');

  // Suggest conventional commit type based on task ID prefix
  let commitType = 'feat';
  if (taskId.toLowerCase().includes('fix') || taskId.toLowerCase().includes('bug')) {
    commitType = 'fix';
  } else if (taskId.toLowerCase().includes('doc')) {
    commitType = 'docs';
  } else if (taskId.toLowerCase().includes('refactor')) {
    commitType = 'refactor';
  } else if (taskId.toLowerCase().includes('test')) {
    commitType = 'test';
  }

  // Build suggested commit message
  const suggestedCommit = `${commitType}: ${summary.toLowerCase().replace(/[.!]$/, '')}`;

  // Create handoff document for charmander
  const handoff = createHandoff({
    from: taskInfo.agent,
    to: 'review-git',
    taskId,
    status: STATUS_COMPLETE,
    confidence: 1.0, // QA passed
    summary,
    filesChanged,
    learnings: [
      `QA Status: PASSED`,
      `Test Results: ${testResults}`,
      `Suggested Commit: ${suggestedCommit}`
    ],
    recommendations: [
      'Review the suggested commit message',
      'Confirm files to be staged',
      'Ask user for commit/push decision'
    ]
  });

  const handoffPath = saveHandoff(handoff, taskId, taskInfo.agent, 'review-git');
  console.log(`[Orchestrator] Created handoff: ${handoffPath}`);

  // Create progress file for git-decision task
  const gitDecisionTaskId = `${taskId}-git-decision`;
  createProgressFile('review-git', gitDecisionTaskId, {
    description: `Git decision for ${taskId}: ${summary}`
  });

  // Store task info for charmander to pick up
  state.activeTasks.set(gitDecisionTaskId, {
    agent: 'review-git',
    status: 'PENDING_DECISION',
    started: new Date().toISOString(),
    workflow: taskInfo.workflow
  });

  // Wake up charmander via tmux injection with git-decision context
  const sessionName = 'cc-review-git';
  const injectCmd = `/git-decision --task ${taskId} --handoff ${handoffPath}`;

  try {
    await injectTmuxCommand(
      { session: sessionName, window: 0, pane: 0 },
      injectCmd
    );
    console.log(`[Orchestrator] Woke up ${sessionName} for git decision`);
  } catch (error) {
    console.error(`[Orchestrator] Failed to inject to ${sessionName}:`, error);
    // Continue to send notification anyway
  }

  // Build notification message
  const message = `📊 QA Results for ${taskId}

Status: ✅ PASSED

${testResults}

Files changed:
${filesList}

Summary:
${summary}

─────────────────────────────────────

Suggested commit:
\`${suggestedCommit}\`

Commit and push?`;

  // Send notification via charmander bot
  const charmanderBot = getBotByRole('review-git');
  const adminChat = charmanderBot?.permissions?.admin_users?.[0];

  if (!adminChat) {
    console.error('[Orchestrator] No admin chat configured for charmander');
    return;
  }

  try {
    const response = await fetch('http://localhost:3100/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bot_id: 'charmander',
        chat_id: adminChat,
        text: message,
        parse_mode: 'Markdown'
      })
    });

    if (!response.ok) {
      console.error('[Orchestrator] Failed to send notification:', await response.text());
    } else {
      console.log('[Orchestrator] Sent git decision notification to user');
    }
  } catch (error) {
    console.error('[Orchestrator] Notification error:', error);
  }
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
          // Validate task has required id field
          if (!task.id) {
            console.error(`[Orchestrator] Task from ${agent} queue missing id field:`, JSON.stringify(task));
            continue;
          }

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
            sendToAgent(agent, `/plan-execute --auto --handoff ${task.handoffPath}`);
          } else if (task.planPath) {
            sendToAgent(agent, `/plan-execute --auto --plan ${task.planPath}`);
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
export async function submitTask(task: { id: string; description?: string; workflow?: string; planPath?: string; chatId?: number }): Promise<{ success: boolean; position?: number }> {
  const workflow = getWorkflow(task.workflow || 'default');
  const firstAgent = workflow.pipeline[0];

  console.log(`[Orchestrator] Submitting task ${task.id} to ${firstAgent}`);

  const result = enqueueTask(firstAgent, {
    id: task.id,
    description: task.description,
    workflow: task.workflow || 'default',
    planPath: task.planPath,
    chatId: task.chatId
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
