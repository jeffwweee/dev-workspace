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

// init - Initialize session (with picker)
program
  .command('init')
  .description('Initialize or resume a session (shows picker if sessions exist)')
  .option('--new', 'Create a new session (skip picker)')
  .option('--resume <session_id>', 'Resume a specific session by ID')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const result = await commands.init({
      new: options.new,
      resume: options.resume
    });
    console.log(formatOutput(result, options.json));
  });

// new - Create new session explicitly
program
  .command('new')
  .description('Create a new session (skip picker)')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const result = await commands.newSession();
    console.log(formatOutput(result, options.json));
  });

// resume - Resume a session
program
  .command('resume')
  .description('Resume an existing session')
  .argument('<session_id>', 'Session ID to resume')
  .option('--json', 'Output as JSON')
  .action(async (sessionId, options) => {
    const result = await commands.resumeSession(sessionId);
    console.log(formatOutput(result, options.json));
  });

// sessions - List all sessions
program
  .command('sessions')
  .description('List all sessions')
  .option('--all', 'Show ended sessions too')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const result = await commands.listSessionsCmd(options.all);
    console.log(formatOutput(result, options.json));
  });

// end - End current session
program
  .command('end')
  .description('End the current session')
  .argument('[session_id]', 'Session ID to end (optional, uses current if not specified)')
  .option('--force', 'Force end even with active locks')
  .option('--json', 'Output as JSON')
  .action(async (sessionId, options) => {
    const result = await commands.endSession(sessionId, options.force);
    console.log(formatOutput(result, options.json));
  });

// worktree - Manage git worktrees
program
  .command('worktree')
  .description('Manage git worktrees for tasks')
  .argument('[subcommand]', 'Subcommand: list, create, remove')
  .argument('[args...]', 'Additional arguments')
  .option('--project <name>', 'Project name (for create/remove)')
  .option('--task <id>', 'Task ID (for create/remove)')
  .option('--branch <name>', 'Branch name (for create)')
  .option('--force', 'Force removal even with uncommitted changes')
  .option('--json', 'Output as JSON')
  .action(async (subcommand, args, options) => {
    let result;
    switch (subcommand || 'list') {
      case 'list':
        result = await commands.worktreeList(options.project);
        break;
      case 'create':
        if (!options.project || !options.task) {
          result = { success: false, error: 'DW_MISSING_ARGS', message: 'worktree create requires --project and --task' };
        } else {
          result = await commands.worktreeCreate(options.project, options.task, options.branch);
        }
        break;
      case 'remove':
        if (!options.project || !options.task) {
          result = { success: false, error: 'DW_MISSING_ARGS', message: 'worktree remove requires --project and --task' };
        } else {
          result = await commands.worktreeRemove(options.project, options.task, options.force);
        }
        break;
      default:
        result = { success: false, error: 'DW_UNKNOWN_SUBCOMMAND', message: `Unknown subcommand: ${subcommand}. Use: list, create, remove` };
    }
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

// work - Start working on a project (switch + cd)
program
  .command('work')
  .description('Start working on a project - switches project and outputs cd command')
  .argument('<project_id>', 'Project ID or name')
  .option('--json', 'Output as JSON')
  .action(async (projectId, options) => {
    const result = await commands.work(projectId);
    console.log(formatOutput(result, options.json));
  });

// done - Finish working on current project
program
  .command('done')
  .description('Finish working on current project - clears active project and outputs cd command')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const result = await commands.done();
    console.log(formatOutput(result, options.json));
  });

// Global for JSON output flag
declare global {
  var jsonOutput: boolean;
}

program.parse();
