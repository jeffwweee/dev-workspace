# Persona/Role/Utility Skills Architecture

**Date:** 2026-03-02
**Status:** Approved
**Author:** Design session with @Jeffwweee

## Overview

A simplified skill architecture for multi-agent teams that separates concerns into three layers: Persona (communication), Role (domain expertise), and Utility (shared tools).

## Design Goals

1. **Simplicity** - Easy to understand and configure
2. **Clear Boundaries** - Each layer has distinct responsibility
3. **Lazy Loading** - Skills load on demand to keep context lean
4. **Centralized Config** - Single file for agent management

## Architecture

### Layer 1: Persona Skills

**Purpose:** Define agent identity and communication channel

**Behavior:**
- Auto-loaded on spawn
- Handles channel-specific formatting (e.g., Telegram MarkdownV2)
- Manages polling and reply mechanisms

**File Location:**
```
.claude/personas/telegram-agent.yaml
```

**Structure:**
```yaml
name: telegram-agent
channel: telegram
response_format: markdownv2
auto_load: true
skills:
  - telegram-agent    # polling + identity
  - telegram-reply    # formatted responses
```

**Current Personas:**
- `telegram-agent` - Telegram channel support
- (Future: discord-agent, cli-agent)

---

### Layer 2: Role Skills

**Purpose:** Bundle domain-specific capabilities and knowledge

**Behavior:**
- Auto-loads on spawn (via --role flag)
- Injects domain knowledge into context
- Lists referenced skills (lazy-loaded on first invocation)

**File Location:**
```
.claude/skills/{role}-developer/SKILL.md
```

**Structure:**
```yaml
---
name: backend-developer
type: role
references:
  skills:
    - dev-test
    - review-code
    - plan-execute
    - db-expert
---

# Backend Developer

## Domain Knowledge
- Node.js/Express
- Java/Spring Boot
- REST API design
- Database patterns

## Referenced Skills
- dev-test: testing utilities
- review-code: code review
- plan-execute: implementation execution
- db-expert: database specialization
```

**Defined Roles:**

| Role | Skills | Domain Focus |
|------|--------|--------------|
| `backend-developer` | dev-test, review-code, plan-execute, db-expert | Node.js, Java/Spring, APIs, Databases |
| `frontend-developer` | dev-test, review-code | React, Vue, CSS, UI |
| `qa-developer` | dev-test, review-verify, dev-docs, dev-git, task-complete | Testing, verification, completion workflow |
| `orchestrator-developer` | comm-brainstorm, commander | Coordination, planning, team management |

---

### Layer 3: Utility Skills

**Purpose:** Shared tools for task completion workflow

**Behavior:**
- Coupled with QA role
- Available to all roles but primarily used by QA
- Lazy-loaded on invocation

**Utility Skills:**
- `dev-git` - Git operations with conventional commits
- `dev-docs` - Documentation creation and updates
- `task-complete` - Task completion and integration

**QA Workflow:**
```
review-code → dev-test → review-verify → dev-docs → dev-git → task-complete
```

---

### Configuration

**File Location:**
```
config/agents.yaml
```

**Structure:**
```yaml
agents:
  pichu:
    persona: telegram-agent
    role: orchestrator-developer

  backend-bot:
    persona: telegram-agent
    role: backend-developer

  frontend-bot:
    persona: telegram-agent
    role: frontend-developer

  qa-bot:
    persona: telegram-agent
    role: qa-developer
```

---

### Spawn Command

**Syntax:**
```bash
/telegram-agent --name {agent} --role {role}-developer
```

**Example:**
```bash
/telegram-agent --name backend-bot --role backend-developer
```

**Spawn Flow:**
1. Load persona (telegram-agent) - auto-loaded
2. Load role skill (backend-developer) - auto-loaded
3. Role skill injects domain knowledge
4. Referenced skills are available (lazy-load on first /skill call)

---

## Skill Loading Strategy

### Hybrid Approach

| Layer | Loading | Reason |
|-------|---------|--------|
| Persona | Auto-load | Required for communication |
| Role | Auto-load | Injects domain context |
| Referenced Skills | Lazy-load | Keeps context lean |

**Benefits:**
- Context stays small - only loaded skills consume tokens
- No complexity - Claude Code handles skill loading on demand
- Clear mental model - role defines "what I can do", skills load when needed

---

## Trade-off Analysis

### vs. Agent Registry + Smart skill.json

**This Design (Persona/Role/Utility):**
- (+) Simpler configuration (2-line per agent)
- (+) Clear responsibility boundaries
- (+) Easier debugging and tracing
- (-) Less flexible for dynamic team composition
- (-) Coarse-grained roles

**Agent Registry Approach:**
- (+) Dynamic team composition per task
- (+) Fine-grained capability matching
- (-) Complex coordination logic
- (-) Registry synchronization overhead

**Conclusion:** For fixed agent types with clear role boundaries, Persona/Role/Utility is the better fit.

---

## Implementation Tasks

1. Create persona file structure (`.claude/personas/`)
2. Create role skills (`backend-developer`, `frontend-developer`, `qa-developer`, `orchestrator-developer`)
3. Update spawn logic to support `--role` flag
4. Create `config/agents.yaml`
5. Implement lazy-loading for referenced skills
6. Update orchestrator to read agent config

---

## Future Considerations

- Discord persona support
- Per-project skill overrides
- Skill versioning
- Custom role creation workflow
