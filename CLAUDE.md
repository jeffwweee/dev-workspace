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

# Integration commands
npx tsx bin/cc-orch.ts adhoc           # List adhoc agents
npx tsx bin/cc-orch.ts learn           # Sync learnings to Redis
npx tsx bin/cc-orch.ts archive         # Run archive cycle
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
