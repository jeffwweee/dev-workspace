# Phase 5: Cleanup - Orchestrator Overhaul

> **For Claude:** REQUIRED SUB-SKILL: Use `executing-plans` or `plan-parallel` skill to implement this plan task-by-task.
> **Depends on:** Phase 4 - Integration

**Goal:** Remove old files, move policies to docs, clean up evolution and agents directories, update modules/bots config to examples, and finalize documentation.

**Architecture:** Clean removal of deprecated components while preserving useful documentation in appropriate locations.

**Tech Stack:** Bash, git

---

## Task 5.1: Move Policies to docs/policies/

**Files:**
- Move: `.claude/policies/` → `docs/policies/`

**Step 1: Create docs/policies directory**

```bash
mkdir -p docs/policies
```

**Step 2: Move policy files**

```bash
mv .claude/policies/ORCHESTRATOR.md docs/policies/
mv .claude/policies/SAFETY_GATES.md docs/policies/
```

**Step 3: Remove old directory**

```bash
rm -rf .claude/policies
```

**Step 4: Commit**

```bash
git add docs/policies/ .claude/policies/
git commit -m "refactor: move policies to docs/policies"
```

---

## Task 5.2: Remove .claude/evolution/

**Files:**
- Remove: `.claude/evolution/`

**Step 1: Remove evolution directory**

```bash
rm -rf .claude/evolution
```

**Step 2: Commit**

```bash
git add .claude/
git commit -m "refactor: remove .claude/evolution (replaced by lib/learning-sync)"
```

---

## Task 5.3: Remove .claude/agents/

**Files:**
- Remove: `.claude/agents/`

**Step 1: Remove agents directory**

```bash
rm -rf .claude/agents
```

**Step 2: Commit**

```bash
git add .claude/
git commit -m "refactor: remove .claude/agents (merged into config/orchestration.yml)"
```

---

## Task 5.4: Remove bin/dw.js and Related Files

**Files:**
- Remove: `bin/dw.js`
- Remove: `bin/dw.js.map`
- Remove: `bin/lib/` (command implementations)
- Remove: `bin/dw-claude`
- Remove: `bin/dw-helper.sh`

**Step 1: Remove old CLI files**

```bash
rm -f bin/dw.js bin/dw.js.map bin/dw-claude bin/dw-helper.sh
rm -rf bin/lib
```

**Step 2: Commit**

```bash
git add bin/
git commit -m "refactor: remove old dw.js CLI (replaced by cc-orch)"
```

---

## Task 5.5: Update modules/bots/config to Examples

**Files:**
- Rename: `modules/bots/config/bots.yaml` → `modules/bots/config/bots.example.yaml`
- Update: `modules/bots/config/README.md`

**Step 1: Rename config to example**

```bash
mv modules/bots/config/bots.yaml modules/bots/config/bots.example.yaml
```

**Step 2: Create README for examples**

`modules/bots/config/README.md`:
```markdown
# Bot Configuration Examples

This directory contains example configuration files.

## Active Configuration

The active bot configuration is now at:
```
../../config/orchestration.yml
```

## Files

- `bots.example.yaml` - Example bot configuration
- `bots.test.yaml` - Test configuration for CI

## Migration

If you have a local `bots.yaml`, migrate your tokens to the new config:

1. Copy your bot tokens to `config/orchestration.yml`
2. Set environment variables: `PIKACHU_BOT_TOKEN`, `RAICHU_BOT_TOKEN`, etc.
3. Delete your local `modules/bots/config/bots.yaml`
```

**Step 3: Commit**

```bash
git add modules/bots/config/
git commit -m "refactor: move bots config to examples, point to new config location"
```

---

## Task 5.6: Remove Old State Files

**Files:**
- Remove: `state/sessions/` (old session format)
- Remove: `state/locks.json` (old lock format)
- Remove: `state/queue.json` (old queue format)
- Keep: `state/.gitkeep`, `state/.migrated-v2`

**Step 1: Remove old state files**

```bash
rm -rf state/sessions
rm -f state/locks.json state/queue.json
```

**Step 2: Commit**

```bash
git add state/
git commit -m "refactor: remove old state files (fresh start with new structure)"
```

---

## Task 5.7: Remove Old Skills (Replaced by New Category-Prefixed Skills)

**Files:**
- Remove: `.claude/skills/writing-plans/` (replaced by `plan-create`)
- Remove: `.claude/skills/project-planner/` (replaced by `task-register`)
- Remove: `.claude/skills/executing-plans/` (replaced by `plan-execute`)
- Remove: `.claude/skills/subagent-driven-development/` (replaced by `plan-parallel`)
- Remove: `.claude/skills/code-reviewer/` (replaced by `review-code`)
- Remove: `.claude/skills/verification-before-completion/` (replaced by `review-verify`)
- Remove: `.claude/skills/git-agent/` (replaced by `dev-git`)
- Remove: `.claude/skills/tester/` (replaced by `dev-test`)
- Remove: `.claude/skills/docs-creator/` (replaced by `dev-docs`)
- Remove: `.claude/skills/systematic-debugging/` (replaced by `dev-debug`)
- Remove: `.claude/skills/brainstorming/` (replaced by `comm-brainstorm`)
- Remove: `.claude/skills/finishing-a-development-branch/` (replaced by `task-complete`)
- Remove: `.claude/skills/project-session/` (replaced by orchestrator)
- Remove: `.claude/skills/copywriting/` (niche, rarely used)

**Step 1: Remove old skill directories**

```bash
rm -rf .claude/skills/writing-plans
rm -rf .claude/skills/project-planner
rm -rf .claude/skills/executing-plans
rm -rf .claude/skills/subagent-driven-development
rm -rf .claude/skills/code-reviewer
rm -rf .claude/skills/verification-before-completion
rm -rf .claude/skills/git-agent
rm -rf .claude/skills/tester
rm -rf .claude/skills/docs-creator
rm -rf .claude/skills/systematic-debugging
rm -rf .claude/skills/brainstorming
rm -rf .claude/skills/finishing-a-development-branch
rm -rf .claude/skills/project-session
rm -rf .claude/skills/copywriting
```

**Step 2: Commit**

```bash
git add .claude/skills/
git commit -m "refactor: remove old skills (replaced by category-prefixed versions)"
```

---

## Task 5.8: Remove Old Phase Plans

---

## Task 5.8: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Update CLAUDE.md with new instructions**

Replace the content with:

```markdown
# CLAUDE.md

Instructions for Claude Code when working with this dev-workspace project.

## Project Overview

This is a multi-agent orchestrator workspace with persistent agents, unified CLI, and file-based state management.

## Key Files

| File | Purpose |
|------|---------|
| `config/orchestration.yml` | Bot, agent, and workflow configuration |
| `lib/*.ts` | Core libraries (spawn-agent, queue-manager, orchestrator, etc.) |
| `bin/cc-orch.ts` | Unified CLI |
| `state/` | Runtime state files |
| `.claude/skills/` | Skill modules |

## CLI Usage

```bash
# Orchestrator control
npx tsx bin/cc-orch.ts start           # Start orchestrator
npx tsx bin/cc-orch.ts status          # Show status
npx tsx bin/cc-orch.ts list            # List agents

# Agent management
npx tsx bin/cc-orch.ts spawn backend   # Spawn backend agent
npx tsx bin/cc-orch.ts kill frontend   # Kill frontend agent

# Task management
npx tsx bin/cc-orch.ts submit TASK-001 # Submit task
npx tsx bin/cc-orch.ts queue backend   # Show queue
```

## Skills

Use skills for structured workflows:

| Category | Skills |
|----------|--------|
| plan-* | `plan-create`, `task-register`, `plan-execute`, `plan-parallel` |
| task-* | `task-complete` |
| review-* | `review-code`, `review-verify` |
| dev-* | `dev-git`, `dev-test`, `dev-docs`, `dev-debug` |
| comm-* | `comm-telegram`, `comm-reply`, `comm-brainstorm` |

## Agent Spawning Reference

When spawning agents, reference `modules/bots/scripts/start-telegram-agent.sh` for:
- Model selection: `claude --model sonnet|opus|haiku`
- Persona injection: `/telegram-agent --name <bot> --who "<persona>"`
- Style configuration: `--response-style professional|casual`

## Conventions

- **Commits**: Conventional commits (`feat:`, `fix:`, `docs:`, etc.)
- **Branches**: `feature/`, `fix/`, `docs/`, `refactor/`
- **Tasks**: TASK-XXX format

## State Files

- `state/primary.md` - Orchestrator memory
- `state/memory/` - Agent memory files
- `state/progress/` - Task progress files
- `state/pending/` - Agent queues
- `state/log/` - Archived state

# currentDate
Today's date is 2026-03-01.
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for v4 orchestrator"
```

---

## Task 5.9: Create Orchestrator README

**Files:**
- Create: `README.md`

**Step 1: Write README**

```markdown
# Dev-Workspace Multi-Agent Orchestrator

A multi-agent orchestration system where a primary orchestrator coordinates multiple Claude Code agents across tmux sessions to execute complex workflows with Telegram integration.

## Quick Start

```bash
# Start orchestrator
npx tsx bin/cc-orch.ts start

# Submit a task
npx tsx bin/cc-orch.ts submit TASK-001 --plan docs/plans/my-plan.md

# Check status
npx tsx bin/cc-orch.ts status
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    DEV-WORKSPACE V4                             │
│                  "Multi-Agent Orchestrator"                     │
├─────────────────────────────────────────────────────────────────┤
│  ENTRY POINTS                                                   │
│  ├── Telegram message → Primary Bot → Task Queue               │
│  └── Plan file created → Watcher detects → Task Queue          │
│                                                                 │
│  PRIMARY ORCHESTRATOR (Claude Code in tmux)                    │
│  ├── Routes tasks to agents                                    │
│  ├── Monitors agent progress                                   │
│  └── Handles inter-agent communication                         │
│                                                                 │
│  AGENT POOL                                                     │
│  ├── backend (pikachu)   - Backend/API development             │
│  ├── frontend (raichu)   - Frontend/UI development             │
│  ├── qa (bulbasaur)      - Testing and verification            │
│  └── review-git (charmander) - Code review + git ops           │
└─────────────────────────────────────────────────────────────────┘
```

## Bots

| Bot | Role | Purpose |
|-----|------|---------|
| pichu | orchestrator | Primary coordinator |
| pikachu | backend | Backend/API development |
| raichu | frontend | Frontend/UI development |
| bulbasaur | qa | Testing and verification |
| charmander | review-git | Code review + git operations |

## Workflows

- **default**: backend → review-git → frontend → review-git → qa
- **backend_only**: backend → review-git → qa
- **frontend_only**: frontend → review-git → qa

## Configuration

See `config/orchestration.yml` for:
- Bot tokens and tmux sessions
- Agent skills and memory files
- Workflow definitions
- Limits and thresholds

## Skills

| Category | Skills |
|----------|--------|
| plan-* | `plan-create`, `task-register`, `plan-execute`, `plan-parallel` |
| task-* | `task-complete` |
| review-* | `review-code`, `review-verify` |
| dev-* | `dev-git`, `dev-test`, `dev-docs`, `dev-debug` |
| comm-* | `comm-telegram`, `comm-reply`, `comm-brainstorm` |

## Development

```bash
# Run tests
npm test

# Build TypeScript
npm run build

# Start orchestrator in dev mode
npx tsx bin/cc-orch.ts start
```

## License

MIT
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README for v4 orchestrator"
```

---

## Task 5.10: Final Verification

**Step 1: Verify directory structure**

Run: `find . -type d -name "node_modules" -prune -o -type d -print | head -50`
Expected: Clean structure with lib/, state/memory/, state/progress/, etc.

**Step 2: Verify CLI works**

Run: `npx tsx bin/cc-orch.ts --help`
Expected: Help text with all commands

**Step 3: Verify skills renamed**

Run: `ls .claude/skills/`
Expected:
```
comm-brainstorm@  comm-reply@  dev-docs/    dev-test/   plan-execute/  review-code/    task-complete/
comm-telegram@    dev-debug/   dev-git/     plan-create/  plan-parallel/  review-verify/  task-register/
```

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final cleanup for v4 orchestrator overhaul"
```

---

## Phase 5 Complete Checklist

- [ ] Policies moved to `docs/policies/`
- [ ] `.claude/evolution/` removed
- [ ] `.claude/agents/` removed
- [ ] Old `bin/dw.js` and related files removed
- [ ] `modules/bots/config/bots.yaml` renamed to example
- [ ] Old state files removed
- [ ] Old phase plans removed
- [ ] `CLAUDE.md` updated
- [ ] `README.md` created
- [ ] Final verification passed

---

## Overhaul Complete!

The multi-agent orchestrator v4 overhaul is complete. To start using:

```bash
# 1. Set up environment variables
export PICHU_BOT_TOKEN="your-token"
export PIKACHU_BOT_TOKEN="your-token"
export RAICHU_BOT_TOKEN="your-token"
export BULBASAUR_BOT_TOKEN="your-token"
export CHARMANDER_BOT_TOKEN="your-token"

# 2. Start the orchestrator
npx tsx bin/cc-orch.ts start

# 3. Submit a task
npx tsx bin/cc-orch.ts submit TASK-001 --plan docs/plans/my-plan.md
```
