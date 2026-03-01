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

program.parse();
