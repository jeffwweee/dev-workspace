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
