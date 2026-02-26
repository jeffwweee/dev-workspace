# Smart Skills & Multi-Agent Teams: Design Document

**Date:** 2026-02-26
**Status:** Approved
**Author:** dev-workspace brainstorming session

---

## Executive Summary

This document defines a unified architecture for skills and agents in dev-workspace. The design introduces clear separation of concerns: **agents are worker types** (core, stable, in registry) and **skills are team compositions** (frequently created, shared via `/find-skills`).

The architecture enables:
- **Orchestrator-led multi-agent teams** for complex development work
- **Domain specialists** that can lead within their expertise
- **Skill inheritance** allowing project-specific overrides of workspace skills
- **Skill discovery** via `/find-skills` powered by Vercel library

---

## Background & Motivation

### Current State

Dev-workspace has 16 skills invoked via `/skill` command and agents dispatched via `Task` tool. However:

1. **Unclear boundary:** Confusion about when to use `/skill` vs Task tool
2. **Static skills:** Skills are passive markdown, not executable configurations
3. **Limited specialization:** All subagents use `general-purpose` type
4. **Manual coordination:** Complex workflows require manual skill chaining
5. **No domain inheritance:** All skills are workspace-level, no project-specific extensions

### Design Goals

1. **Clear boundary:** Skills orchestrate, agents execute
2. **Domain specialists:** TypeScript, Python, Rust, etc. have dedicated agents
3. **Smart skills:** Skills are executable configs that know which agents to call
4. **Multi-agent teams:** Coordinated work with specialist collaboration
5. **Two-tier skills:** Generic workspace skills + project-specific extensions
6. **Easy discovery:** Find and install skills via `/find-skills`

---

## Architecture Overview

### Core Principle

```
Skills = "I need to do X" (orchestration/config)
Agents = "I know how to do X" (execution/expertise)
```

### System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     AGENT REGISTRY                          │
│  Core worker types (stable, rarely changes)                 │
│                                                              │
│  Coordinators:    orchestrator-agent                        │
│  Domains:         ts-specialist, python-specialist,          │
│                   rust-specialist, react-specialist,         │
│                   grammy-specialist                          │
│  Quality/Ops:     tester-agent, code-reviewer,               │
│                   debugger-agent, docs-agent, git-agent      │
│  Foundation:      planner-agent, writer-agent                │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │ references
                            │
┌───────────────────────────┴───────────────────────────────┐
│                      SKILLS                                │
│  Team compositions (frequently created, shared)             │
│                                                              │
│  Workspace skills (generic):                                │
│  ├── feature-development  (orchestrator + ts + tester)     │
│  ├── bug-hunting-team      (debugger + code-reviewer)      │
│  └── systematic-debugging  (debugger-agent leads)          │
│                                                              │
│  Project skills (domain-specific, extend workspace):        │
│  ├── telegram-bot-workflow (grammy-specialist leads)       │
│  └── staffportal-workflow   (ts-specialist leads)          │
│                                                              │
│  External skills (via /find-skills):                        │
│  ├── @dw/skill-security-audit                              │
│  ├── @dw/skill-ml-training                                 │
│  └── @dw/skill-graphql-api                                 │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │ discovered
                            │
┌───────────────────────────┴───────────────────────────────┐
│                    /find-skills                            │
│  Powered by Vercel AI SDK library                          │
│  Searches npm for @dev-workspace/skill-* packages           │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Specifications

### 1. Agent Registry

**Location:** `.claude/agents/registry.json`

Agents are **core worker types** that are:
- Infrequently added (only for new domains)
- Stable across projects
- Referenced by skills

#### Agent Schema

```json
{
  "version": "1.0",
  "agents": {
    "<agent-id>": {
      "type": "coordinator|specialist|foundation",
      "description": "Human-readable description",
      "capabilities": ["capability1", "capability2"],
      "model": "opus|sonnet|haiku",
      "tools": ["Tool1", "Tool2"],
      "can_lead": ["domain1", "domain2"],
      "extends": "<parent-agent-id>",
      "system_prompt": "Path or inline prompt",
      "stable": true
    }
  }
}
```

#### Core Agent Types

| Agent ID | Type | Purpose | Can Lead |
|----------|------|---------|----------|
| `orchestrator-agent` | coordinator | Cross-domain team coordination | any |
| `planner-agent` | foundation | Design and planning | planning |
| `ts-specialist` | specialist | TypeScript/Node.js backend | typescript, backend, api |
| `python-specialist` | specialist | Python backend | python, backend, api |
| `rust-specialist` | specialist | Rust backend | rust, backend |
| `react-specialist` | specialist | React frontend | react, frontend, ui |
| `grammy-specialist` | specialist | Telegram bots (extends ts) | telegram, bot, grammy |
| `tester-agent` | specialist | Testing and verification | testing, qa |
| `code-reviewer` | specialist | Code review and quality | - |
| `debugger-agent` | specialist | Root cause analysis | debugging, investigation |
| `docs-agent` | specialist | Documentation | - |
| `git-agent` | specialist | Git operations | - |
| `writer-agent` | foundation | Writing and communication | - |

---

### 2. Smart Skill Structure

**Locations:**
- Workspace: `.claude/skills/<skill-name>/`
- Project: `<project>/.claude/skills/<skill-name>/`
- External: Installed via `/find-skills`

#### Skill File Structure

```
.claude/skills/<skill-name>/
├── SKILL.md              # Human-readable documentation
├── skill.json            # Executable configuration (NEW)
├── package.json          # For npm publishing (external skills)
└── prompts/              # Optional prompt templates
    ├── default.md
    └── <mode>.md
```

#### skill.json Schema

```json
{
  "name": "skill-name",
  "description": "Human-readable description",
  "version": "1.0.0",

  "extends": "workspace://<skill-name>",

  "team": {
    "orchestrator": {
      "type": "dynamic|<agent-id>",
      "selection": {
        "condition1": "<agent-id>",
        "default": "<agent-id>"
      }
    },
    "members": [
      {
        "role": "role-name",
        "agent": "dynamic|<agent-id>",
        "selection": {
          "project-type": "<agent-id>"
        },
        "required": true,
        "phase": "planning|implementation|verification",
        "parallel_with": ["other-role"],
        "depends_on": ["other-role"]
      }
    ]
  },

  "adaptive": {
    "complexity": {
      "small": {"max_members": 2, "roles": ["backend", "test"]},
      "medium": {"max_members": 4, "roles": ["backend", "frontend", "test"]},
      "large": {"max_members": 6}
    },
    "add_on_demand": {
      "if_tests_failing": "debugger-agent",
      "if_security_sensitive": "code-reviewer"
    }
  },

  "context": {
    "inject": ["PROJECT_CONTEXT.md", "progress.md"],
    "working_directory": "{{worktree|project}}"
  },

  "validation": {
    "required": ["tests_pass", "lint_ok"],
    "commands": ["npm test", "npm run lint"]
  },

  "workflow": {
    "next_skill": "verification-before-completion",
    "modes": {
      "implement": "prompts/implement.md",
      "test": "tester-agent"
    }
  },

  "metadata": {
    "tags": ["feature", "workflow"],
    "project_types": ["typescript", "python"],
    "estimated_duration": "2-4 hours"
  }
}
```

---

### 3. Two-Tier Skill System

#### Workspace Skills (Generic)

**Location:** `.claude/skills/`

Technology-agnostic skills that work across any project:

| Skill | Purpose | Orchestrator |
|-------|---------|--------------|
| `brainstorming` | Design exploration | planner-agent |
| `writing-plans` | Create implementation plans | planner-agent |
| `project-session` | Main orchestrator | orchestrator-agent |
| `project-planner` | Task management | coordinator-agent |
| `git-agent` | Git operations | git-agent |
| `docs-creator` | Documentation updates | docs-agent |
| `code-reviewer` | Generic code review | code-reviewer |
| `tester` | Generic test execution | tester-agent |
| `systematic-debugging` | Root cause investigation | debugger-agent |
| `verification-before-completion` | Evidence checks | qa-agent |
| `finishing-a-development-branch` | Merge/PR/cleanup | orchestrator-agent |
| `session-cleanup` | Session termination | coordinator-agent |
| `subagent-driven-development` | Plan execution | orchestrator-agent |
| `executing-plans` | Batch plan execution | orchestrator-agent |
| `feature-development` | Full feature workflow | dynamic |

#### Project Skills (Technology-Specific)

**Location:** `<project>/.claude/skills/`

Domain-specific skills that extend or override workspace skills:

| Skill | Purpose | Project Type |
|-------|---------|--------------|
| `typescript-backend` | TypeScript backend patterns | Node.js API |
| `telegram-bot-grammy` | Telegram bot with grammY | Telegram bots |
| `python-django` | Django backend patterns | Django apps |
| `rust-backend` | Rust backend patterns | Rust services |

#### Skill Inheritance

When a project session loads, skills are merged:

```
1. Load workspace skills from .claude/skills/
2. Load project skills from <project>/.claude/skills/
3. Merge: project skills extend/override workspace skills
4. Build active skill registry
```

**Example inheritance:**

```json
// Workspace: .claude/skills/code-reviewer/skill.json
{
  "name": "code-reviewer",
  "agent": {"type": "code-reviewer"},
  "validation": {
    "checks": ["structure", "security", "error-handling"]
  }
}

// Project: tg-bots/.claude/skills/code-reviewer/skill.json
{
  "extends": "workspace://code-reviewer",
  "validation": {
    "checks": ["type-safety", "grammy-patterns", "workers-patterns"]
  }
}

// Result: Merged skill with TypeScript + grammY specific checks
```

---

### 4. Orchestrator-Led Multi-Agent Teams

#### Principle: Specialists Can Lead

A specialist agent can act as **both** domain expert **and** orchestrator for tasks within their domain.

```
ts-specialist:
  - Can implement TypeScript code (as specialist)
  - Can lead feature development (as orchestrator for TS projects)

orchestrator-agent:
  - Coordinates cross-domain work
  - Never writes code directly (pure coordinator)
```

#### Team Configurations

**Feature Development Team**

```
Goal: Build complete feature from design to deployment

Orchestrator: feature-orchestrator (dynamic)
  - TypeScript project → ts-specialist leads
  - Full-stack → orchestrator-agent leads
  - Telegram bot → grammy-specialist leads

Team:
  ├── design-agent (creates initial design)
  ├── backend-agent (implements API)
  ├── frontend-agent (implements UI) [parallel with backend]
  ├── test-agent (writes/verifies tests)
  └── docs-agent (updates documentation)

Workflow:
  1. design-agent creates design
  2. [parallel] backend + frontend implement
  3. test-agent verifies all
  4. docs-agent updates docs
  5. orchestrator merges and validates
```

**Multi-Layer Change Team**

```
Goal: Coordinated changes across database → API → frontend

Orchestrator: orchestrator-agent (cross-domain)

Team:
  ├── database-agent (schema changes, migrations)
  ├── backend-agent (API updates)
  └── frontend-agent (component updates)

Workflow:
  1. All agents analyze current state (parallel)
  2. database-agent proposes schema changes
  3. [after db approved] backend-agent implements API
  4. [after api approved] frontend-agent implements UI
  5. Integration test and validate
```

**Complex Debugging Team**

```
Goal: Root cause analysis for complex bugs

Orchestrator: debug-orchestrator (debugger-agent leads)

Team:
  ├── repro-agent (reproduce the bug)
  ├── code-agent (analyze code paths)
  ├── log-agent (investigate logs/metrics)
  └── research-agent (find similar issues)

Workflow:
  1. [parallel] All agents investigate (different angles)
  2. Orchestrator compares findings
  3. Agents confer on most likely cause
  4. fix-agent implements fix
  5. verify-agent confirms fix
```

#### Orchestration Patterns

**Sequential Pipeline**
```
Agent A ──done──> Agent B ──done──> Agent C ──done──> Complete
```
Use when: Each agent's output is the next agent's input

**Parallel Execution**
```
                    ┌──> Agent A ──┐
Orchestrator ──dispatch─┼──> Agent B ──┼──> merge results
                    └──> Agent C ──┘
```
Use when: Tasks are independent

**Hybrid (Parallel-Sequential)**
```
                    ┌──> Agent A ──┐
Orchestrator ──dispatch─┼──> Agent B ──┼──> Agent D ──> Complete
                    └──> Agent C ──┘       (depends on A,B,C)
```
Use when: Initial parallel work, then sequential integration

---

### 5. Skill Discovery with /find-skills

#### Powered by Vercel AI SDK

Skills are published as npm packages with standard structure:

```
@dev-workspace/skill-<name>/
├── package.json
├── SKILL.md
├── skill.json
└── prompts/
    └── default.md
```

#### package.json Format

```json
{
  "name": "@dev-workspace/skill-feature-development",
  "version": "1.0.0",
  "description": "Build complete features with coordinated specialist team",
  "keywords": ["dev-workspace-skill", "feature", "workflow", "team"],
  "devWorkspace": {
    "type": "skill",
    "agent_types": ["orchestrator-agent", "ts-specialist", "tester-agent"],
    "project_types": ["typescript", "python", "rust"],
    "category": "workflow"
  }
}
```

#### /find-skills Command

```bash
/find-skills security

# Uses Vercel AI SDK to search npm registry
# Filters by keywords, project types, agents
# Returns matching skills with metadata

Output:
Found 3 skills:

1. security-audit (@dev-workspace/skill-security-audit)
   Description: Security-focused code review and vulnerability scanning
   Agents: code-reviewer, debugger-agent
   Version: 2.1.0
   → /install-skill security-audit

2. secure-backend (@dev-workspace/skill-secure-backend)
   Description: Security patterns for backend APIs
   Agents: ts-specialist, code-reviewer
   → /install-skill secure-backend

3. owasp-check (@dev-workspace/skill-owasp-check)
   Description: OWASP Top 10 vulnerability scanning
   → /install-skill owasp-check
```

#### Installing Skills

```bash
/install-skill security-audit

# What happens:
1. npm install @dev-workspace/skill-security-audit
2. Extracts to .claude/skills/security-audit/
3. Validates skill.json (references existing agents)
4. Registers skill in workspace skill index
5. Available for use

# Skill is now available:
/security-audit scan-backend
```

#### Skill Index

**Location:** `.claude/skills/index.json`

```json
{
  "installed": {
    "feature-development": {
      "package": "@dev-workspace/skill-feature-development",
      "version": "1.0.0",
      "installed_at": "2026-02-26T10:00:00Z",
      "location": ".claude/skills/feature-development/"
    },
    "security-audit": {
      "package": "@dev-workspace/skill-security-audit",
      "version": "2.1.0",
      "installed_at": "2026-02-26T11:30:00Z"
    }
  }
}
```

---

## Integration with Existing Dev-Workspace

### Session Management

No changes to existing session infrastructure:

```bash
node bin/dw.js init           # Create session
node bin/dw.js switch <project>  # Set active project
node bin/dw.js status          # Show status
```

### Lock System

Skills respect existing lock mechanisms:

```bash
node bin/dw.js claim --task TASK-001  # Claim before work
# ... skill executes ...
node bin/dw.js release --all          # Release when done
```

### Worktree Isolation

Skills work in worktrees as before:

```bash
node bin/dw.js claim --task TASK-001
# Worktree created at ~/worktrees/<project>/TASK-001/
# Skill executes in worktree
```

### Safety Gates

Skills respect existing safety gates:
- **Start Gate:** Correct project, lock claimed, context loaded
- **Completion Gate:** Verification run, progress updated, git checkpoint
- **End Gate:** Progress logged, tasks updated, lock released

---

## Usage Examples

### Example 1: Simple Backend Feature (Specialist Leads)

```bash
# Project: tg-agent (TypeScript bot)
# Task: Add /help command

/feature-development --goal "Add /help command"

# Orchestrator selects:
#   - Leader: grammy-specialist (can lead Telegram projects)
#   - Team: grammy-specialist (implements) + tester-agent (verifies)
#   - Complexity: small (2 members)

Workflow:
  grammy-specialist:
    - Implements /help command
    - Writes tests
    - Self-reviews

  tester-agent:
    - Verifies tests pass
    - Smoke tests /help command

Result: Feature implemented with 2-agent team
```

### Example 2: Full-Stack Feature (Orchestrator Leads)

```bash
# Project: Web app (TypeScript backend + React frontend)
# Task: Add user profile page

/feature-development --goal "Add user profile page"

# Orchestrator selects:
#   - Leader: orchestrator-agent (cross-domain work)
#   - Team: ts-specialist (backend) + react-specialist (frontend) + tester-agent
#   - Complexity: medium (4 members)

Workflow:
  orchestrator-agent coordinates:
    1. ts-specialist implements profile API
    2. react-specialist implements profile page (parallel after API spec)
    3. tester-agent verifies integration
    4. orchestrator validates end-to-end
```

### Example 3: Project Skill with Inheritance

```bash
# In tg-bots project session
/code-reviewer

# Uses merged skill:
#   - Workspace: generic code review patterns
#   - Project override: TypeScript + grammY specific checks
#   - Agent: ts-grammy-specialist (project override)
```

---

## Error Handling & Recovery

### Agent Failure

```
Scenario: Test agent reports tests failing

Orchestrator:
  1. Stop frontend deployment (blocked)
  2. Dispatch debugger-agent to investigate
  3. Backend agent fixes issue
  4. Test agent retries
  5. If still failing → escalate to human
```

### Agent Disagreement

```
Scenario: Backend agent wants JWT, frontend wants localStorage

Orchestrator detects conflict → Options:
  1. Ask human for direction
  2. Research best practices (dispatch research-agent)
  3. Propose compromise: HttpOnly cookies + short-lived tokens
```

### Stuck Agent

```
Scenario: Frontend agent hasn't reported progress (90 seconds)

Orchestrator:
  1. TaskStop(frontend_agent_id)
  2. Analyze what was completed
  3. Restart with more specific task
  4. If repeatedly stuck → escalate
```

---

## Implementation Phases

### Phase 1: Foundation
- skill.json schema definition
- Agent registry with core agents
- Skill router (workspace → project → not found)
- Basic skill execution

### Phase 2: Orchestrator-Led Teams
- Team composition in skill.json
- Dynamic agent selection
- Specialist-as-orchestrator pattern
- Parallel/sequential workflows

### Phase 3: Skill Discovery
- /find-skills with Vercel library
- npm package format for skills
- /install-skill command
- Skill index management

### Phase 4: Advanced Features
- Skill inheritance with merge semantics
- Adaptive team composition
- Error handling and recovery
- Skill validation and linting

---

## Success Criteria

1. **Clear boundary:** Users understand when to use skills vs agents
2. **Domain expertise:** Specialists provide better quality than general-purpose
3. **Easy discovery:** /find-skills finds relevant skills quickly
4. **Team coordination:** Multi-agent workflows complete successfully
5. **Backward compatible:** Existing skills work without changes
6. **Extensible:** Users can add project-specific skills easily

---

## Open Questions

1. **Agent versioning:** How to handle breaking changes in agent capabilities?
2. **Skill marketplace:** Should there be an official skill registry beyond npm?
3. **Agent limits:** How many agents can run in parallel before performance degrades?
4. **Context size:** How to manage context when many agents are involved?
5. **Testing skills:** How to test skills before publishing?

---

## References

- `.claude/policies/ORCHESTRATOR.md` - Current orchestration rules
- `.claude/skills/subagent-driven-development/SKILL.md` - v2.0 subagent pattern
- `docs/subagent-driven-development-v2.md` - Subagent documentation
- Vercel AI SDK - Package discovery and installation

---

**Document Status:** Approved - Ready for implementation planning
