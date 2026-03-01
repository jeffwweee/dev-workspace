#!/usr/bin/env node

import { Command } from 'commander';
import {
  initialize,
  runLoop,
  stop,
  getStatus,
  submitTask,
  getCoreAgents
} from '../lib/orchestrator';

import {
  spawnAgent,
  killAgent,
  isAgentRunning,
  listAgentSessions
} from '../lib/spawn-agent';

import {
  getQueueLength,
  clearQueue
} from '../lib/queue-manager';

// Import integration modules
import { advanceToNextStage, getStageInfo } from '../lib/pipeline-router';
import { notifyBlocked, notifyFailed, notifyComplete } from '../lib/telegram-notifier';
import { spawnAdhocAgent, listAdhocAgents, cleanupIdleAdhocAgents } from '../lib/adhoc-manager';
import { syncAllAgents, syncToEvolutionRegistry } from '../lib/learning-sync';
import { runArchiveCycle, listArchiveContents } from '../lib/archive-manager';

const program = new Command();

program
  .name('cc-orch')
  .description('Claude Code Orchestrator - Multi-agent coordination')
  .version('1.0.0');

// Orchestrator control
program.command('start')
  .description('Start the orchestrator loop')
  .option('--no-spawn', 'Don\'t spawn agents on start')
  .action(async (options) => {
    console.log('Starting orchestrator...');

    if (options.spawn !== false) {
      await initialize();
    }

    console.log('Running orchestrator loop. Press Ctrl+C to stop.');

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
    if (status.activeTasks.size === 0) {
      console.log('  None');
    } else {
      status.activeTasks.forEach((info, id) => {
        console.log(`  ${id}: ${info.agent} (${info.status})`);
      });
    }
  });

// Agent management
program.command('spawn <agent>')
  .description('Spawn a specific agent')
  .option('--adhoc', 'Spawn as adhoc agent')
  .option('--persona <text>', 'Agent persona')
  .action((agent, options) => {
    const result = spawnAgent({
      name: agent,
      isAdhoc: options.adhoc || false,
      persona: options.persona,
      memoryFile: `state/memory/${agent}.md`
    });
    console.log('Spawn result:', result);
  });

program.command('kill <agent>')
  .description('Kill an agent session')
  .option('--adhoc', 'Kill adhoc agent')
  .action((agent, options) => {
    const result = killAgent(agent, options.adhoc || false);
    console.log('Kill result:', result);
  });

program.command('list')
  .description('List all running agent sessions')
  .action(() => {
    const sessions = listAgentSessions();
    console.log('Running agent sessions:');
    sessions.forEach(s => console.log(`  - ${s}`));
  });

// Task management
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
  .description('Show agent queue length')
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

// Workflow
program.command('workflow <name>')
  .description('Show workflow configuration')
  .action((name) => {
    const { getWorkflow } = require('../lib/orchestration-config');
    const workflow = getWorkflow(name);
    console.log(`Workflow: ${name}`);
    console.log('Pipeline:', workflow.pipeline.join(' -> '));
    console.log('Review threshold:', workflow.review_threshold);
    console.log('Max retries:', workflow.max_retries);
  });

// Agents list
program.command('agents')
  .description('List core agents')
  .action(() => {
    const agents = getCoreAgents();
    console.log('Core agents:', agents.join(', '));
  });

// Pipeline advancement
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

// Adhoc agent management
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

// Learning sync
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

// Archive management
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

// Notifications
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

program.parse();
