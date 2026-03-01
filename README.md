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
