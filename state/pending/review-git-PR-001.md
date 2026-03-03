# PR-001: Create Pull Request to Main

## Priority
High

## Context
From pichu orchestrator session (chat 195061634)

## Task
Create a pull request from `feature/multi-agent-orchestrator-v4` to `main`.

## Branch Information
- **Source branch:** `feature/multi-agent-orchestrator-v4`
- **Target branch:** `main`
- **Commits ahead:** 122 commits

## Key Features in this PR

### Multi-Agent Orchestrator v4
- Unified orchestration configuration (`config/orchestration.yml`)
- Agent spawning with tmux integration
- Queue management and task assignment
- Memory and progress file management
- Pipeline routing (backend_only, frontend_only, default)

### Handler Skills
- `backend-handler` - Backend task processing
- `frontend-handler` - Frontend task processing
- `qa-handler` - QA verification
- `review-git-handler` - Git operations and PR creation

### Telegram Integration
- Telegram gateway for bot communications
- Agent notification system (`bin/agent-notify.ts`)
- Telegram skills (`telegram-agent`, `telegram-reply`)

### CLI Tools
- `cc-orch.ts` - Unified orchestrator CLI
- Commands: start, status, list, spawn, kill, submit, queue

### Bug Fixes (Recent)
- Fixed `agent-notify.ts` Redis channel name (`outbox` → `tg:outbox`)
- Fixed orchestrator regex patterns for multiline progress fields
- Separated git operations to review-git agent only

## Suggested PR Title
```
feat: Multi-agent orchestrator v4 with Telegram integration
```

## Suggested PR Body
```markdown
## Summary
- Implements multi-agent orchestrator v4 with unified configuration
- Adds handler skills for backend, frontend, QA, and git operations
- Integrates Telegram gateway for agent communications
- Provides unified CLI for orchestrator management

## Changes
- **Orchestrator:** Unified config, agent spawning, queue management
- **Skills:** Handler skills for each pipeline stage
- **Telegram:** Gateway, notification system, skills
- **CLI:** cc-orch.ts for all orchestrator operations

## Test Plan
- [ ] Orchestrator starts and monitors agents
- [ ] Tasks can be submitted and routed to correct agents
- [ ] Telegram notifications are sent correctly
- [ ] Pipeline flows work (backend → qa → review-git)
```

## Files Changed (Key Files)
- `lib/orchestrator.ts` - Main orchestrator loop
- `lib/spawn-agent.ts` - Agent spawning
- `lib/queue-manager.ts` - Task queue management
- `bin/cc-orch.ts` - Unified CLI
- `bin/agent-notify.ts` - Notification system
- `config/orchestration.yml` - Unified configuration
- `.claude/skills/*-handler/SKILL.md` - Handler skills

## Verification
1. Check branch is up to date with remote
2. Verify all tests pass (if any)
3. Create PR with suggested title and body
4. Share PR URL with user

## Notes
- User requested this PR creation
- Branch has 122 commits, consider squashing if needed
