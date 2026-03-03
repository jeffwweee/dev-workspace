# Dev-Workspace Multi-Agent Orchestrator Overhaul Design

> **For Claude:** REQUIRED SUB-SKILL: Use `writing-plans` skill to create implementation plan from this design.

**Goal:** Overhaul dev-workspace to implement the multi-agent orchestrator architecture, replacing the session-based model with persistent agent-based orchestration.

**Architecture:** Primary orchestrator (Claude Code in tmux) manages core agents (backend, frontend, qa, review-git) running in dedicated tmux sessions. File-based state management with unified YAML config. Telegram bots for each agent with role-based routing.

**Tech Stack:** TypeScript, tmux, Redis, Telegram Bot API, YAML config

---

## Overview

### Problem

Current dev-workspace uses a session-based model that requires:
- Manual session management
- Manual task delegation
- No persistent agents
- No automated workflow pipeline
- Scattered configuration

### Solution

1. **Persistent Agents** - Core agents always running in tmux sessions
2. **Unified CLI** - `cc-orch` replaces `dw.js` for all operations
3. **Pipeline Workflows** - Automated stage routing (backend → review → frontend → review → qa)
4. **Single Config** - All bots, agents, workflows in `config/orchestration.yml`
5. **File-based State** - Simple state management in `state/` directory

---

## Directory Structure

```
dev-workspace/
├── bin/
│   └── cc-orch.ts              # Unified CLI
├── lib/
│   ├── spawn-agent.ts          # Agent spawning (tmux + CLAUDECODE workaround)
│   ├── queue-manager.ts        # Agent queue management
│   ├── memory-manager.ts       # Memory file handling
│   ├── handoff.ts              # Inter-agent handoff documents
│   ├── orchestration-config.ts # Config loader
│   ├── orchestrator.ts         # Main orchestrator loop
│   ├── pipeline-router.ts      # Pipeline stage routing
│   ├── review-git-agent.ts     # Review-git integration
│   ├── telegram-notifier.ts    # Telegram notifications
│   ├── adhoc-manager.ts        # Adhoc agent spawning
│   ├── learning-sync.ts        # Learning sync to Redis
│   └── archive-manager.ts      # Archive system
├── config/
│   └── orchestration.yml       # Unified config (bots, agents, workflows)
├── state/
│   ├── primary.md              # Orchestrator memory
│   ├── memory/                 # Agent memory files
│   │   ├── backend.md
│   │   ├── frontend.md
│   │   ├── qa.md
│   │   └── review-git.md
│   ├── progress/               # Task progress files
│   │   └── task-001.md
│   ├── pending/                # Agent queues
│   │   ├── backend.json
│   │   ├── frontend.json
│   │   ├── qa.json
│   │   └── review-git.json
│   ├── log/                    # Archived state
│   │   └── 2026-03/
│   └── rss/                    # RSS queue
├── .claude/
│   ├── skills/                 # Reorganized skills
│   │   ├── plan-create/
│   │   ├── task-register/
│   │   ├── plan-execute/
│   │   ├── plan-parallel/
│   │   ├── task-complete/
│   │   ├── review-code/
│   │   ├── review-verify/
│   │   ├── dev-git/
│   │   ├── dev-test/
│   │   ├── dev-docs/
│   │   ├── dev-debug/
│   │   ├── comm-telegram/
│   │   ├── comm-reply/
│   │   └── comm-brainstorm/
│   └── references/             # Reference docs (keep as-is)
├── docs/
│   └── policies/               # Moved from .claude/policies/
└── modules/bots/               # Telegram bot module (config becomes examples)
```

---

## Configuration

### config/orchestration.yml

```yaml
bots:
  # Primary orchestrator bot
  - name: pichu
    token: ${PICHU_BOT_TOKEN}
    username: pichu_cc_bot
    role: orchestrator
    tmux:
      session: cc-orchestrator
      window: 0
      pane: 0
    permissions:
      allowed_chats: [195061634]
      admin_users: [195061634]

  # Backend agent bot
  - name: pikachu
    token: ${PIKACHU_BOT_TOKEN}
    username: pikachu_cc_bot
    role: backend
    tmux:
      session: cc-backend
      window: 0
      pane: 0
    agent_config:
      skills: [dev-test, review-code]
      memory: state/memory/backend.md
    permissions:
      allowed_chats: [195061634, -100123456789]
      admin_users: [195061634]

  # Frontend agent bot
  - name: raichu
    token: ${RAICHU_BOT_TOKEN}
    username: raichu_cc_bot
    role: frontend
    tmux:
      session: cc-frontend
    agent_config:
      skills: [dev-test, review-code]
      memory: state/memory/frontend.md
    permissions:
      allowed_chats: [195061634]
      admin_users: [195061634]

  # QA agent bot
  - name: bulbasaur
    token: ${BULBASAUR_BOT_TOKEN}
    username: bulbasaur_cc_bot
    role: qa
    tmux:
      session: cc-qa
    agent_config:
      skills: [dev-test, review-verify]
      memory: state/memory/qa.md
    permissions:
      allowed_chats: [195061634]
      admin_users: [195061634]

  # Review-git agent bot
  - name: charmander
    token: ${CHARMANDER_BOT_TOKEN}
    username: charmander_cc_bot
    role: review-git
    tmux:
      session: cc-review
    agent_config:
      skills: [review-code, dev-git]
      memory: state/memory/review-git.md
      outputs: [confidence_score, commit_hash]
    permissions:
      allowed_chats: [195061634]
      admin_users: [195061634]

workflows:
  default:
    pipeline: [backend, review-git, frontend, review-git, qa]
    review_threshold: 0.8
    max_retries: 3
    retry_backoff_base_ms: 30000

  backend_only:
    pipeline: [backend, review-git, qa]
    review_threshold: 0.85

  frontend_only:
    pipeline: [frontend, review-git, qa]
    review_threshold: 0.75

limits:
  max_adhoc_per_type: 2
  max_total_adhoc: 5
  max_queue_length: 3
  adhoc_idle_timeout_ms: 1800000

orchestrator:
  loop_interval_ms: 30000
  telegram_poll_interval_ms: 5000
  plan_watch_enabled: true
  plan_watch_paths:
    - "docs/plans/*.md"

archiving:
  max_file_size_kb: 50
  max_task_count: 50
  weekly_archive: true

cleanup:
  adhoc_idle_timeout_ms: 1800000
  core_agent_clear_on_complete: true
```

---

## CLI Commands (cc-orch)

```
# Orchestrator control
cc-orch start                   # Start orchestrator loop
cc-orch stop                    # Stop orchestrator
cc-orch status                  # Show orchestrator status

# Agent management
cc-orch spawn <agent>           # Spawn a specific agent
cc-orch kill <agent>            # Kill an agent session
cc-orch list                    # List all running agent sessions

# Task management
cc-orch submit <taskId>         # Submit a task to the queue
cc-orch queue <agent>           # Show agent queue
cc-orch clear-queue <agent>     # Clear agent queue

# Adhoc agents
cc-orch adhoc                   # List adhoc agents
cc-orch adhoc spawn <type>      # Spawn adhoc agent
cc-orch adhoc kill <session>    # Kill adhoc agent

# Review & Pipeline
cc-orch review <taskId>         # Submit task for review
cc-orch advance <taskId>        # Advance task to next stage
cc-orch workflow <name>         # Show workflow config

# Learning & Archive
cc-orch learn                   # Sync learning to Redis
cc-orch archive                 # Run archive cycle
cc-orch archive-list            # List archive contents

# Notifications
cc-orch notify <type>           # Send test notification

# RSS (optional)
cc-orch rss-poll                # Run RSS poller
cc-orch rss-queue               # Show RSS queue
cc-orch rss-clear               # Clear RSS queue
```

---

## Skills (14 total)

### Skill Categories

| Category | Skills | Purpose |
|----------|--------|---------|
| **plan-*** | `plan-create`, `task-register`, `plan-execute`, `plan-parallel` | Planning and execution |
| **task-*** | `task-complete` | Task completion handling |
| **review-*** | `review-code`, `review-verify` | Code review and verification |
| **dev-*** | `dev-git`, `dev-test`, `dev-docs`, `dev-debug` | Development utilities |
| **comm-*** | `comm-telegram`, `comm-reply`, `comm-brainstorm` | Communication |

### Skill Details

| New Name | Former Name | Description |
|----------|-------------|-------------|
| `plan-create` | `writing-plans` | Create implementation plans from requirements |
| `task-register` | `project-planner` (part) | Register tasks from plan into queue |
| `plan-execute` | `executing-plans` | Execute plan sequentially in current session |
| `plan-parallel` | `subagent-driven-development` | Execute plan with fresh subagents per task |
| `task-complete` | `finishing-a-development-branch` | Handle merge/PR/cleanup decisions |
| `review-code` | `code-reviewer` | Code review and quality checks |
| `review-verify` | `verification-before-completion` | Verify before claiming done |
| `dev-git` | `git-agent` | Git operations |
| `dev-test` | `tester` | Run tests |
| `dev-docs` | `docs-creator` | Create/update documentation |
| `dev-debug` | `systematic-debugging` | Debugging workflow |
| `comm-telegram` | `telegram-agent` | Telegram bot agent |
| `comm-reply` | `telegram-reply` | Telegram response handling |
| `comm-brainstorm` | `brainstorming` | Design exploration |

### Skill Flow

```
plan-create → task-register → plan-execute (simple) OR plan-parallel (development)
                                    ↓
                            review-code (if in pipeline)
                                    ↓
                            review-verify
                                    ↓
                            dev-docs
                                    ↓
                            task-complete
```

---

## Removed/Replaced Items

| Item | Action |
|------|--------|
| `bin/dw.js` | Replaced by `bin/cc-orch.ts` |
| `project-session` skill | Replaced by orchestrator |
| `copywriting` skill | Removed (niche) |
| `.claude/evolution/` | Replaced by `lib/learning-sync.ts` |
| `.claude/policies/` | Moved to `docs/policies/`, incorporated into orchestrator |
| `.claude/agents/` | Merged into `config/orchestration.yml` |

---

## Bots and Agent Routing

### Bot-to-Agent Mapping

| Bot | Role | Tmux Session | Purpose |
|-----|------|--------------|---------|
| pichu | orchestrator | cc-orchestrator | Primary coordinator |
| pikachu | backend | cc-backend | Backend/API development |
| raichu | frontend | cc-frontend | Frontend/UI development |
| bulbasaur | qa | cc-qa | Testing and verification |
| charmander | review-git | cc-review | Code review + git ops |

### Routing Logic

```
Task assigned to: backend
        ↓
Lookup bot with role: backend
        ↓
Found: pikachu
        ↓
Route to tmux session: cc-backend
        ↓
Wake command via: pikachu bot token
```

---

## Implementation Phases

### Phase 1: Foundation
- Create new directory structure (`lib/`, `state/memory/`, etc.)
- Create `config/orchestration.yml`
- Create `lib/spawn-agent.ts` with CLAUDECODE workaround
- Create memory and queue file templates

### Phase 2: Core Libraries
- Create `lib/queue-manager.ts`
- Create `lib/memory-manager.ts`
- Create `lib/handoff.ts`
- Create `lib/orchestration-config.ts`
- Create `lib/orchestrator.ts` (main loop)

### Phase 3: CLI & Skills
- Create `bin/cc-orch.ts` CLI
- Rename and reorganize skills
- Update skill SKILL.md files

### Phase 4: Integration
- Create `lib/pipeline-router.ts`
- Create `lib/review-git-agent.ts`
- Create `lib/telegram-notifier.ts`
- Create `lib/adhoc-manager.ts`
- Create `lib/learning-sync.ts`
- Create `lib/archive-manager.ts`

### Phase 5: Cleanup
- Remove old `bin/dw.js` and related files
- Move policies to docs
- Remove `.claude/evolution/`
- Remove `.claude/agents/`
- Update `modules/bots/config/` to examples

---

## CLAUDECODE Workaround

When spawning agent tmux sessions, unset CLAUDECODE to allow Claude Code to start:

```bash
# Wrong - inherits CLAUDECODE=1
tmux new-session -d -s cc-backend
tmux send-keys -t cc-backend "claude" Enter

# Correct - unset CLAUDECODE
tmux new-session -d -s cc-backend
tmux send-keys -t cc-backend "env -u CLAUDECODE claude" Enter
```

Reference: https://github.com/anthropics/claude-agent-sdk-python/issues/573

---

## Dependencies

| Dependency | Purpose |
|------------|---------|
| tmux | Session management, agent isolation |
| Redis | Learning sync, message queuing |
| js-yaml | YAML config parsing |
| commander | CLI framework |
| TypeScript | Type safety, compilation |

---

## Migration Notes

1. **Config Migration**: Move bot tokens from `modules/bots/config/` to `config/orchestration.yml`
2. **State Migration**: Existing state in `state/` can be cleared (fresh start)
3. **Skills Migration**: Rename existing skills, update symlinks
4. **CLI Migration**: Update any scripts referencing `dw.js` to use `cc-orch`
