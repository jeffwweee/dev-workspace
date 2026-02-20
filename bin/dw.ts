#!/usr/bin/env node
import { Command } from 'commander';
import * as commands from './lib/commands/index.js';
import { readJson, getStatePath, generateId, atomicWrite, auditLog } from './lib/state/manager.js';

const program = new Command();

program
  .name('dw')
  .description('Dev-Workspace CLI - Multi-session Claude Code orchestration')
  .version('1.0.0');

// Global --json flag for JSON output
program.hook('preAction', (thisCommand) => {
  const opts = thisCommand.opts();
  global.jsonOutput = opts.json || false;
});

// Helper function to format output
function formatOutput(data: unknown, useJson: boolean = false): string {
  if (useJson || global.jsonOutput) {
    return JSON.stringify(data, null, 2);
  }
  if (typeof data === 'string') return data;
  return JSON.stringify(data, null, 2);
}

// init - Initialize session
program
  .command('init')
  .description('Create a new session and initialize state files')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const result = await commands.init();
    console.log(formatOutput(result, options.json));
  });

// status - Show workspace status
program
  .command('status')
  .description('Show session, locks, and next tasks')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const result = await commands.status();
    console.log(formatOutput(result, options.json));
  });

// add - Add project to registry
program
  .command('add')
  .description('Add a project to the registry')
  .argument('<name>', 'Project name')
  .option('--path <path>', 'Path to project (required)')
  .option('--remote <url>', 'Remote repository URL')
  .option('--json', 'Output as JSON')
  .action(async (name, options) => {
    const result = await commands.addProject(name, options);
    console.log(formatOutput(result, options.json));
  });

// switch - Set active project
program
  .command('switch')
  .description('Switch to a different project')
  .argument('<project_id>', 'Project ID or name')
  .option('--json', 'Output as JSON')
  .action(async (projectId, options) => {
    const result = await commands.switchProject(projectId);
    console.log(formatOutput(result, options.json));
  });

// claim - Acquire a lock
program
  .command('claim')
  .description('Acquire a lock on a project or task')
  .option('--project <id>', 'Project ID to lock')
  .option('--task <task_id>', 'Specific task ID to lock')
  .option('--owner <id>', 'Owner identifier (default: auto-generated)')
  .option('--ttl <minutes>', 'Lock TTL in minutes (default: 120)', '120')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const result = await commands.claim(options);
    console.log(formatOutput(result, options.json));
  });

// release - Release locks
program
  .command('release')
  .description('Release one or all locks')
  .option('--lock <lock_id>', 'Specific lock ID to release')
  .option('--all', 'Release all locks owned by current session')
  .option('--owner <id>', 'Owner identifier')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const result = await commands.release(options);
    console.log(formatOutput(result, options.json));
  });

// heartbeat - Update lock TTLs
program
  .command('heartbeat')
  .description('Refresh lock TTLs to prevent expiration')
  .option('--owner <id>', 'Owner identifier')
  .option('--lock <lock_id>', 'Specific lock to refresh')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const result = await commands.heartbeat(options);
    console.log(formatOutput(result, options.json));
  });

// cleanup-locks - Mark stale locks expired
program
  .command('cleanup-locks')
  .description('Mark expired or stale locks')
  .option('--force', 'Also clear locks older than 24 hours')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const result = await commands.cleanupLocks(options);
    console.log(formatOutput(result, options.json));
  });

// pick-next - Select next task by priority
program
  .command('pick-next')
  .description('Select the next available task from queue')
  .option('--project <id>', 'Filter by project ID')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const result = await commands.pickNext(options);
    console.log(formatOutput(result, options.json));
  });

// record-result - Log task completion
program
  .command('record-result')
  .description('Record the result of a completed task')
  .requiredOption('--task <id>', 'Task ID')
  .requiredOption('--status <status>', 'Status: passed, failed, partial, blocked')
  .option('--files <files>', 'Comma-separated list of changed files')
  .option('--summary <text>', 'Summary of changes')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const result = await commands.recordResult(options);
    console.log(formatOutput(result, options.json));
  });

// list-projects - List all registered projects
program
  .command('list-projects')
  .description('List all projects in the registry')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const result = await commands.listProjects();
    console.log(formatOutput(result, options.json));
  });

// queue - Show task queue
program
  .command('queue')
  .description('Show the current task queue')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const result = await commands.showQueue();
    console.log(formatOutput(result, options.json));
  });

// Global for JSON output flag
declare global {
  var jsonOutput: boolean;
}

program.parse();
