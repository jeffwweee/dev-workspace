# CLAUDE.md

Instructions for Claude Code when working with this dev-workspace project.

## Project Overview

This is a multi-session Claude Code workspace with state management, lock handling, and skill-based orchestration. It enables multiple Claude Code instances to work safely on multiple projects.

## Key Files

| File | Purpose |
|------|---------|
| `.claude/WORKSPACE_CONTEXT.md` | Full workspace context and architecture |
| `.claude/policies/SAFETY_GATES.md` | Safety gate definitions |
| `.claude/policies/ORCHESTRATOR.md` | Orchestration rules |
| `.claude/skills/*/SKILL.md` | Skill definitions |
| `.claude/references/*.md` | Reusable reference docs |
| `bin/dw.js` | CLI implementation |
| `state/` | Runtime state files |

## CLI Usage

Always use `node bin/dw.js` to run the CLI:

```bash
node bin/dw.js init
node bin/dw.js status
node bin/dw.js claim --task TASK-001
node bin/dw.js release --all
```

## Skills

Use skills for structured workflows:

- `/skill project-session` - Start an orchestrated work session
- `/skill project-planner` - Manage tasks
- `/skill docs-creator` - Create/update documentation
- `/skill git-agent` - Git operations
- `/skill code-reviewer` - Review code
- `/skill tester` - Run tests

## Safety Rules

1. **ALWAYS claim locks before work** - Use `node bin/dw.js claim --task <id>`
2. **NEVER write code directly in project-session** - Delegate to skills
3. **ALWAYS update progress.md** - Document what was done
4. **ALWAYS release locks when done** - Use `node bin/dw.js release --all`

## Return Contract

All skill outputs should follow this format:

```
Status: SUCCESS|FAILURE|PARTIAL|BLOCKED

Summary:
- What was done

Files changed:
- List of files

Commands run:
- Commands executed

Evidence:
- Proof of work

Next recommended:
- Next action or "none"
```

## Conventions

- **Commits**: Conventional commits (`feat:`, `fix:`, `docs:`, etc.)
- **Branches**: `feature/`, `fix/`, `docs/`, `refactor/`, `test/`, `chore/`
- **Tasks**: TASK-XXX format with priority 1-5

## State Files

- `state/active.json` - Current session and active project
- `state/locks.json` - Active locks with TTL
- `state/queue.json` - Task queue
- `state/audit.log` - Append-only event log (JSONL)
- `registry/projects.json` - Registered projects

## When Making Changes

1. Read relevant files first
2. Claim a lock if modifying shared state
3. Follow existing patterns
4. Update documentation if architecture changes
5. Run `npm run build` if modifying TypeScript
