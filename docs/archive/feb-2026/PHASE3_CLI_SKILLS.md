# Phase 3: CLI & Skills - Orchestrator Overhaul

> **For Claude:** REQUIRED SUB-SKILL: Use `executing-plans` or `plan-parallel` skill to implement this plan task-by-task.
> **Depends on:** Phase 2 - Core Libraries

**Goal:** Create the unified `cc-orch` CLI and reorganize skills with new naming conventions.

**Architecture:** Single CLI binary handles all orchestrator, agent, and task operations. Skills are renamed with category prefixes (plan-*, task-*, review-*, dev-*, comm-*).

**Tech Stack:** TypeScript, Commander.js

---

## Task 3.1: Install CLI Dependencies

**Step 1: Install dependencies**

```bash
npm install commander @types/node
npm install --save-dev tsx
```

**Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add CLI dependencies"
```

---

## Task 3.2: Create bin/cc-orch.ts

**Files:**
- Create: `bin/cc-orch.ts`

**Step 1: Write cc-orch.ts**

```typescript
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
    console.log('Pipeline:', workflow.pipeline.join(' → '));
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
```

**Step 2: Make executable**

```bash
chmod +x bin/cc-orch.ts
```

**Step 3: Test CLI**

Run: `npx tsx bin/cc-orch.ts --help`
Expected: CLI help text displayed

**Step 4: Commit**

```bash
git add bin/cc-orch.ts
git commit -m "feat(orchestrator): add cc-orch CLI"
```

---

## Task 3.3: Rename Skills - plan-* Category

**Files:**
- Rename: `.claude/skills/writing-plans/` → `.claude/skills/plan-create/`
- Rename: `.claude/skills/project-planner/` → `.claude/skills/task-register/`
- Rename: `.claude/skills/executing-plans/` → `.claude/skills/plan-execute/`
- Rename: `.claude/skills/subagent-driven-development/` → `.claude/skills/plan-parallel/`

**Step 1: Rename directories**

```bash
cd .claude/skills
mv writing-plans plan-create
mv project-planner task-register
mv executing-plans plan-execute
mv subagent-driven-development plan-parallel
```

**Step 2: Update SKILL.md files**

Update each skill's SKILL.md to reflect new name. Example for `plan-create/SKILL.md`:

```markdown
---
name: plan-create
description: "Create detailed implementation plans from requirements or design documents. Use after brainstorming or when given a task to implement."
---

# Plan Create

## Overview

Creates bite-sized implementation plans from requirements or design documents.

## Usage

```bash
/plan-create --task TASK-001
/plan-create --design docs/plans/feature-design.md
```

## Flow

plan-create → task-register → plan-execute OR plan-parallel
```

**Step 3: Commit**

```bash
git add .claude/skills/
git commit -m "refactor(skills): rename plan-* and task-register skills"
```

---

## Task 3.4: Rename Skills - review-* Category

**Files:**
- Rename: `.claude/skills/code-reviewer/` → `.claude/skills/review-code/`
- Rename: `.claude/skills/verification-before-completion/` → `.claude/skills/review-verify/`

**Step 1: Rename directories**

```bash
cd .claude/skills
mv code-reviewer review-code
mv verification-before-completion review-verify
```

**Step 2: Update SKILL.md frontmatter**

Update `name` field in each SKILL.md.

**Step 3: Commit**

```bash
git add .claude/skills/
git commit -m "refactor(skills): rename review-* skills"
```

---

## Task 3.5: Rename Skills - dev-* Category

**Files:**
- Rename: `.claude/skills/git-agent/` → `.claude/skills/dev-git/`
- Rename: `.claude/skills/tester/` → `.claude/skills/dev-test/`
- Rename: `.claude/skills/docs-creator/` → `.claude/skills/dev-docs/`
- Rename: `.claude/skills/systematic-debugging/` → `.claude/skills/dev-debug/`

**Step 1: Rename directories**

```bash
cd .claude/skills
mv git-agent dev-git
mv tester dev-test
mv docs-creator dev-docs
mv systematic-debugging dev-debug
```

**Step 2: Commit**

```bash
git add .claude/skills/
git commit -m "refactor(skills): rename dev-* skills"
```

---

## Task 3.6: Rename Skills - comm-* Category

**Files:**
- Rename: `.claude/skills/telegram-agent/` → `.claude/skills/comm-telegram/` (symlink)
- Rename: `.claude/skills/telegram-reply/` → `.claude/skills/comm-reply/` (symlink)
- Rename: `.claude/skills/brainstorming/` → `.claude/skills/comm-brainstorm/`

**Step 1: Rename brainstorming**

```bash
cd .claude/skills
mv brainstorming comm-brainstorm
```

**Step 2: Update symlinks for telegram skills**

```bash
cd .claude/skills
rm -f telegram-agent telegram-reply
ln -s ../../modules/bots/.claude/skills/telegram-agent comm-telegram
ln -s ../../modules/bots/.claude/skills/telegram-reply comm-reply
```

**Step 3: Commit**

```bash
git add .claude/skills/
git commit -m "refactor(skills): rename comm-* skills"
```

---

## Task 3.7: Rename Skills - task-* Category

**Files:**
- Rename: `.claude/skills/finishing-a-development-branch/` → `.claude/skills/task-complete/`

**Step 1: Rename directory**

```bash
cd .claude/skills
mv finishing-a-development-branch task-complete
```

**Step 2: Commit**

```bash
git add .claude/skills/
git commit -m "refactor(skills): rename task-complete skill"
```

---

## Task 3.8: Remove Unused Skills

**Files:**
- Remove: `.claude/skills/project-session/` (replaced by orchestrator)
- Remove: `.claude/skills/copywriting/` (niche)

**Step 1: Remove directories**

```bash
cd .claude/skills
rm -rf project-session
rm -rf copywriting
```

**Step 2: Commit**

```bash
git add .claude/skills/
git commit -m "refactor(skills): remove project-session and copywriting"
```

---

## Task 3.9: Verify Skill Structure

**Step 1: List skills**

Run: `ls -la .claude/skills/`
Expected:
```
comm-brainstorm/
comm-telegram@ (symlink)
comm-reply@ (symlink)
dev-debug/
dev-docs/
dev-git/
dev-test/
plan-create/
plan-execute/
plan-parallel/
references/
review-code/
review-verify/
task-complete/
task-register/
```

**Step 2: Verify each skill has SKILL.md**

Run: `find .claude/skills -name "SKILL.md" | wc -l`
Expected: 14 (or 12 if symlinks don't count)

---

## Phase 3 Complete Checklist

- [ ] `bin/cc-orch.ts` CLI created
- [ ] `plan-create` skill renamed from `writing-plans`
- [ ] `task-register` skill renamed from `project-planner`
- [ ] `plan-execute` skill renamed from `executing-plans`
- [ ] `plan-parallel` skill renamed from `subagent-driven-development`
- [ ] `task-complete` skill renamed from `finishing-a-development-branch`
- [ ] `review-code` skill renamed from `code-reviewer`
- [ ] `review-verify` skill renamed from `verification-before-completion`
- [ ] `dev-git` skill renamed from `git-agent`
- [ ] `dev-test` skill renamed from `tester`
- [ ] `dev-docs` skill renamed from `docs-creator`
- [ ] `dev-debug` skill renamed from `systematic-debugging`
- [ ] `comm-telegram` symlink updated
- [ ] `comm-reply` symlink updated
- [ ] `comm-brainstorm` skill renamed from `brainstorming`
- [ ] `project-session` skill removed
- [ ] `copywriting` skill removed

**Next Phase:** Phase 4 - Integration (pipeline-router, review-git-agent, telegram-notifier, adhoc-manager, learning-sync, archive-manager)
