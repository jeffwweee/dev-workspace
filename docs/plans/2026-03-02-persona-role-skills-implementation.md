# Persona/Role/Utility Skills Implementation Plan

> **Design Doc:** `docs/plans/2026-03-02-persona-role-skills-design.md`
> **For Claude:** REQUIRED SUB-SKILL: Use `plan-execute` or `plan-parallel` skill to implement this plan task-by-task.

**Goal:** Implement the Persona/Role/Utility skill architecture for multi-agent teams.

**Architecture:** Three-layer skill system - Persona (communication), Role (domain expertise), Utility (shared tools). Personas and roles auto-load on spawn; referenced skills lazy-load on first invocation.

**Tech Stack:** TypeScript, YAML, existing spawn-agent.ts, orchestration-config.ts

---

## Task 1: Create Persona Directory Structure

**Files:**
- Create: `.claude/personas/telegram-agent.yaml`

**Step 1: Create personas directory**

```bash
mkdir -p .claude/personas
```

**Step 2: Create telegram-agent persona file**

Create `.claude/personas/telegram-agent.yaml`:

```yaml
name: telegram-agent
channel: telegram
response_format: markdownv2
auto_load: true
skills:
  - telegram-agent    # polling + identity
  - telegram-reply    # formatted responses
```

**Step 3: Verify file structure**

Run: `ls -la .claude/personas/`
Expected: `telegram-agent.yaml` exists

**Step 4: Commit**

```bash
git add .claude/personas/
git commit -m "feat(skills): add telegram-agent persona definition"
```

---

## Task 2: Create Backend Developer Role Skill

**Files:**
- Create: `.claude/skills/backend-developer/SKILL.md`

**Step 1: Create role skill directory**

```bash
mkdir -p .claude/skills/backend-developer
```

**Step 2: Create backend-developer SKILL.md**

Create `.claude/skills/backend-developer/SKILL.md`:

```markdown
---
name: backend-developer
type: role
description: Backend developer role with Node.js, Java/Spring Boot expertise. Auto-loads dev-test, review-code, plan-execute, db-expert skills.
references:
  skills:
    - dev-test
    - review-code
    - plan-execute
    - db-expert
---

# Backend Developer

## Overview

You are a backend developer specializing in server-side applications, APIs, and database patterns.

## Domain Knowledge

**Languages & Frameworks:**
- Node.js/Express/Fastify
- Java/Spring Boot
- TypeScript

**Patterns:**
- REST API design
- GraphQL schema design
- Database patterns (repository, unit of work)
- Message queues and event-driven architecture

**Best Practices:**
- Input validation and sanitization
- Error handling and logging
- Security (authentication, authorization, injection prevention)
- Performance optimization

## Referenced Skills

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| dev-test | Testing utilities | Write/run tests, verify functionality |
| review-code | Code review | Review changes for quality and security |
| plan-execute | Implementation execution | Follow implementation plans |
| db-expert | Database specialization | Complex queries, migrations, optimization |

## Workflow

1. **Understand requirements** - Read task description and acceptance criteria
2. **Design approach** - Plan the implementation strategy
3. **Implement** - Write clean, tested code
4. **Test** - Use dev-test to verify functionality
5. **Review** - Use review-code for quality check
```

**Step 3: Verify skill loads correctly**

Run: `head -20 .claude/skills/backend-developer/SKILL.md`
Expected: YAML frontmatter with name, type, references

**Step 4: Commit**

```bash
git add .claude/skills/backend-developer/
git commit -m "feat(skills): add backend-developer role skill"
```

---

## Task 3: Create Frontend Developer Role Skill

**Files:**
- Create: `.claude/skills/frontend-developer/SKILL.md`

**Step 1: Create role skill directory**

```bash
mkdir -p .claude/skills/frontend-developer
```

**Step 2: Create frontend-developer SKILL.md**

Create `.claude/skills/frontend-developer/SKILL.md`:

```markdown
---
name: frontend-developer
type: role
description: Frontend developer role with React, Vue, CSS expertise. Auto-loads dev-test, review-code skills.
references:
  skills:
    - dev-test
    - review-code
---

# Frontend Developer

## Overview

You are a frontend developer specializing in user interfaces, component design, and client-side applications.

## Domain Knowledge

**Frameworks:**
- React (hooks, context, server components)
- Vue.js (composition API, Pinia)
- Next.js/Nuxt.js

**Styling:**
- CSS/SCSS/Tailwind CSS
- CSS-in-JS (styled-components, emotion)
- Responsive design

**Patterns:**
- Component composition
- State management (Redux, Zustand, Pinia)
- Data fetching (React Query, SWR)

**Best Practices:**
- Accessibility (WCAG)
- Performance (lazy loading, code splitting)
- SEO optimization
- Cross-browser compatibility

## Referenced Skills

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| dev-test | Testing utilities | Component tests, integration tests |
| review-code | Code review | Review UI changes for quality |

## Workflow

1. **Understand design** - Review mockups, specs, or requirements
2. **Component design** - Plan component structure and state
3. **Implement** - Build components with proper styling
4. **Test** - Use dev-test for component testing
5. **Review** - Use review-code for quality check
```

**Step 3: Verify skill structure**

Run: `head -20 .claude/skills/frontend-developer/SKILL.md`
Expected: YAML frontmatter with name, type, references

**Step 4: Commit**

```bash
git add .claude/skills/frontend-developer/
git commit -m "feat(skills): add frontend-developer role skill"
```

---

## Task 4: Create QA Developer Role Skill

**Files:**
- Create: `.claude/skills/qa-developer/SKILL.md`

**Step 1: Create role skill directory**

```bash
mkdir -p .claude/skills/qa-developer
```

**Step 2: Create qa-developer SKILL.md**

Create `.claude/skills/qa-developer/SKILL.md`:

```markdown
---
name: qa-developer
type: role
description: QA developer role for testing, verification, and completion workflow. Includes utility skills for docs, git, and task completion.
references:
  skills:
    - dev-test
    - review-verify
    - review-code
    - dev-docs
    - dev-git
    - task-complete
---

# QA Developer

## Overview

You are a QA developer responsible for testing, verification, and the completion workflow. You ensure code quality before finalizing tasks.

## Domain Knowledge

**Testing:**
- Unit testing strategies
- Integration testing
- E2E testing (Playwright, Cypress)
- Performance testing

**Verification:**
- Acceptance criteria validation
- Regression testing
- Smoke testing
- Code quality checks

**Documentation:**
- Progress documentation
- API documentation
- Test reports

## Referenced Skills

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| dev-test | Testing utilities | Run tests, verify functionality |
| review-verify | Verification | Final verification before completion |
| review-code | Code review | Review for quality and compliance |
| dev-docs | Documentation | Update docs, create progress files |
| dev-git | Git operations | Commit changes with conventional commits |
| task-complete | Task completion | Mark task done, decide integration |

## Completion Workflow

```
review-code → dev-test → review-verify → dev-docs → dev-git → task-complete
```

1. **review-code** - Review code quality and compliance
2. **dev-test** - Run all tests, verify passing
3. **review-verify** - Final verification of requirements
4. **dev-docs** - Update documentation
5. **dev-git** - Commit with conventional commits
6. **task-complete** - Mark task complete, handle integration

## Critical Rules

- **Never skip verification** - Always run tests and verify before completion
- **Evidence before assertions** - Provide proof of success
- **Document decisions** - Record what was done and why
```

**Step 3: Verify skill structure**

Run: `head -20 .claude/skills/qa-developer/SKILL.md`
Expected: YAML frontmatter with name, type, references including utility skills

**Step 4: Commit**

```bash
git add .claude/skills/qa-developer/
git commit -m "feat(skills): add qa-developer role skill with utility workflow"
```

---

## Task 5: Create Orchestrator Developer Role Skill

**Files:**
- Create: `.claude/skills/orchestrator-developer/SKILL.md`

**Step 1: Create role skill directory**

```bash
mkdir -p .claude/skills/orchestrator-developer
```

**Step 2: Create orchestrator-developer SKILL.md**

Create `.claude/skills/orchestrator-developer/SKILL.md`:

```markdown
---
name: orchestrator-developer
type: role
description: Orchestrator role for coordinating multi-agent teams, planning, and workflow management. Auto-loads comm-brainstorm, commander skills.
references:
  skills:
    - comm-brainstorm
    - commander
---

# Orchestrator Developer

## Overview

You are an orchestrator responsible for coordinating multi-agent teams, guiding workflows, and managing task distribution.

## Domain Knowledge

**Coordination:**
- Multi-agent team management
- Task distribution and routing
- Agent spawning and lifecycle
- Inter-agent communication

**Planning:**
- Design facilitation
- Implementation planning
- Workflow definition
- Priority management

**Workflow Guidance:**
- Brainstorm → Design → Plan → Execute
- Task tracking and status
- Review and verification coordination

## Referenced Skills

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| comm-brainstorm | Design exploration | Facilitate brainstorming, explore ideas |
| commander | Command handling | Process messages, guide workflows |

## Core Responsibilities

1. **Receive user requests** - Poll for and process incoming messages
2. **Detect intent** - Understand what the user wants to do
3. **Route to appropriate skill** - Invoke brainstorm, plan, or execute
4. **Track sessions** - Maintain conversation context
5. **Coordinate agents** - Spawn and manage specialized agents

## Workflow Detection

| User Says | Action |
|-----------|--------|
| "brainstorm", "design", "explore" | Invoke comm-brainstorm |
| "create plan", "implementation plan" | Invoke plan-create |
| "execute", "run plan" | Invoke plan-execute |
| "test", "verify" | Invoke dev-test |
| "commit", "git" | Invoke dev-git |

## Session Management

Maintain session state in `state/sessions/{chat_id}.md`:
- Current mode (brainstorming/designing/planning/executing)
- Active task ID
- Key decisions and context
- Next steps
```

**Step 3: Verify skill structure**

Run: `head -20 .claude/skills/orchestrator-developer/SKILL.md`
Expected: YAML frontmatter with name, type, references

**Step 4: Commit**

```bash
git add .claude/skills/orchestrator-developer/
git commit -m "feat(skills): add orchestrator-developer role skill"
```

---

## Task 6: Create Agents Configuration File

**Files:**
- Create: `config/agents.yaml`

**Step 1: Create agents config file**

Create `config/agents.yaml`:

```yaml
# Agent Configuration
# Maps agent names to persona + role combinations

agents:
  # Primary orchestrator
  pichu:
    persona: telegram-agent
    role: orchestrator-developer
    bot_config: pichu  # References gateway.yaml

  # Backend specialist
  pikachu:
    persona: telegram-agent
    role: backend-developer
    bot_config: pikachu

  # Frontend specialist
  raichu:
    persona: telegram-agent
    role: frontend-developer
    bot_config: raichu

  # QA specialist (includes utility skills)
  bulbasaur:
    persona: telegram-agent
    role: qa-developer
    bot_config: bulbasaur
```

**Step 2: Verify config structure**

Run: `cat config/agents.yaml`
Expected: YAML with agents mapping

**Step 3: Commit**

```bash
git add config/agents.yaml
git commit -m "feat(config): add agents.yaml for persona/role mapping"
```

---

## Task 7: Update BotConfig Interface

**Files:**
- Modify: `lib/orchestration-config.ts:11-30`

**Step 1: Add persona and role to BotConfig interface**

Update the `BotConfig` interface in `lib/orchestration-config.ts`:

```typescript
export interface BotConfig {
  name: string;
  token: string;
  username?: string;
  role: string;
  tmux: {
    session: string;
    window?: number;
    pane?: number;
  };
  agent_config?: {
    skills?: string[];
    memory?: string;
    outputs?: string[];
    persona?: string;      // Add: persona name (e.g., telegram-agent)
    role_skill?: string;   // Add: role skill name (e.g., backend-developer)
  };
  permissions?: {
    allowed_chats?: number[];
    admin_users?: number[];
  };
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit lib/orchestration-config.ts`
Expected: No errors

**Step 3: Commit**

```bash
git add lib/orchestration-config.ts
git commit -m "feat(config): add persona and role_skill to BotConfig interface"
```

---

## Task 8: Update Orchestration Config

**Files:**
- Modify: `config/orchestration.yml`

**Step 1: Add persona and role_skill to each bot**

Update `config/orchestration.yml` to include persona and role_skill:

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
    agent_config:
      persona: telegram-agent
      role_skill: orchestrator-developer
      memory: state/memory/orchestrator.md
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
      persona: telegram-agent
      role_skill: backend-developer
      memory: state/memory/backend.md
    permissions:
      allowed_chats: [195061634]
      admin_users: [195061634]

  # Frontend agent bot
  - name: raichu
    token: ${RAICHU_BOT_TOKEN}
    username: raichu_cc_bot
    role: frontend
    tmux:
      session: cc-frontend
    agent_config:
      persona: telegram-agent
      role_skill: frontend-developer
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
      persona: telegram-agent
      role_skill: qa-developer
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
      persona: telegram-agent
      role_skill: qa-developer  # Uses QA skills for review workflow
      memory: state/memory/review-git.md
      outputs: [confidence_score, commit_hash]
    permissions:
      allowed_chats: [195061634]
      admin_users: [195061634]
```

**Step 2: Verify YAML is valid**

Run: `python3 -c "import yaml; yaml.safe_load(open('config/orchestration.yml'))"`
Expected: No errors

**Step 3: Commit**

```bash
git add config/orchestration.yml
git commit -m "feat(config): add persona and role_skill to bot configurations"
```

---

## Task 9: Create Persona Loader Module

**Files:**
- Create: `lib/persona-loader.ts`

**Step 1: Create persona loader module**

Create `lib/persona-loader.ts`:

```typescript
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PERSONAS_DIR = path.join(__dirname, '..', '.claude', 'personas');

export interface PersonaConfig {
  name: string;
  channel: string;
  response_format: string;
  auto_load: boolean;
  skills: string[];
}

let personaCache: Record<string, PersonaConfig> = {};

/**
 * Load a persona configuration by name
 */
export function loadPersona(name: string): PersonaConfig | null {
  if (personaCache[name]) {
    return personaCache[name];
  }

  const personaPath = path.join(PERSONAS_DIR, `${name}.yaml`);

  if (!fs.existsSync(personaPath)) {
    console.warn(`[PersonaLoader] Persona not found: ${name}`);
    return null;
  }

  try {
    const content = fs.readFileSync(personaPath, 'utf-8');
    const persona = yaml.load(content) as PersonaConfig;
    personaCache[name] = persona;
    return persona;
  } catch (error) {
    console.error(`[PersonaLoader] Failed to load persona ${name}:`, error);
    return null;
  }
}

/**
 * Get skills to auto-load for a persona
 */
export function getPersonaSkills(personaName: string): string[] {
  const persona = loadPersona(personaName);
  return persona?.skills || [];
}

/**
 * Clear persona cache (for testing)
 */
export function clearCache(): void {
  personaCache = {};
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit lib/persona-loader.ts`
Expected: No errors

**Step 3: Commit**

```bash
git add lib/persona-loader.ts
git commit -m "feat(lib): add persona-loader module"
```

---

## Task 10: Create Role Skill Loader Module

**Files:**
- Create: `lib/role-loader.ts`

**Step 1: Create role loader module**

Create `lib/role-loader.ts`:

```typescript
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SKILLS_DIR = path.join(__dirname, '..', '.claude', 'skills');

export interface RoleReferences {
  skills?: string[];
}

export interface RoleConfig {
  name: string;
  type: 'role';
  description?: string;
  references?: RoleReferences;
}

let roleCache: Record<string, RoleConfig> = {};

/**
 * Parse SKILL.md frontmatter to extract role config
 */
function parseSkillFile(filePath: string): RoleConfig | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    // Extract YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
      return null;
    }

    const frontmatter = yaml.load(frontmatterMatch[1]) as RoleConfig;
    return frontmatter;
  } catch (error) {
    console.error(`[RoleLoader] Failed to parse ${filePath}:`, error);
    return null;
  }
}

/**
 * Load a role skill configuration by name
 */
export function loadRole(name: string): RoleConfig | null {
  if (roleCache[name]) {
    return roleCache[name];
  }

  const rolePath = path.join(SKILLS_DIR, name, 'SKILL.md');

  if (!fs.existsSync(rolePath)) {
    console.warn(`[RoleLoader] Role skill not found: ${name}`);
    return null;
  }

  const role = parseSkillFile(rolePath);
  if (role) {
    roleCache[name] = role;
  }
  return role;
}

/**
 * Get referenced skills for a role (lazy-load targets)
 */
export function getReferencedSkills(roleName: string): string[] {
  const role = loadRole(roleName);
  return role?.references?.skills || [];
}

/**
 * Check if a skill is a role skill (has type: role in frontmatter)
 */
export function isRoleSkill(skillName: string): boolean {
  const role = loadRole(skillName);
  return role?.type === 'role';
}

/**
 * Clear role cache (for testing)
 */
export function clearCache(): void {
  roleCache = {};
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit lib/role-loader.ts`
Expected: No errors

**Step 3: Commit**

```bash
git add lib/role-loader.ts
git commit -m "feat(lib): add role-loader module for skill references"
```

---

## Task 11: Update Spawn Agent with Role Support

**Files:**
- Modify: `lib/spawn-agent.ts`

**Step 1: Update SpawnOptions interface**

Add `role` to `SpawnOptions`:

```typescript
export interface SpawnOptions {
  name: string;
  persona?: string;
  role?: string;        // Add: role skill name
  skills?: string[];
  memoryFile?: string;
  isAdhoc?: boolean;
  model?: 'sonnet' | 'opus' | 'haiku';
  style?: 'professional' | 'casual';
}
```

**Step 2: Import loaders at top of file**

Add imports at the top of `lib/spawn-agent.ts`:

```typescript
import { getPersonaSkills } from './persona-loader.js';
import { getReferencedSkills, isRoleSkill } from './role-loader.js';
```

**Step 3: Update spawnAgent function to use persona and role**

Replace the skill loading section in `spawnAgent` function:

```typescript
export function spawnAgent(options: SpawnOptions): SpawnResult {
  const {
    name,
    persona,
    role,
    skills = [],
    memoryFile,
    isAdhoc = false,
    model = 'sonnet',
    style = 'professional'
  } = options;

  const sessionName = isAdhoc ? `cc-adhoc-${name}` : `cc-${name}`;

  // Check if session already exists
  try {
    execSync(`tmux has-session -t ${sessionName} 2>/dev/null`);
    return { sessionName, status: 'already_exists' };
  } catch {
    // Session doesn't exist, create it
  }

  // Create tmux session
  try {
    execSync(`tmux new-session -d -s ${sessionName} -x 200 -y 50 2>/dev/null || true`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { sessionName, status: 'error', error: message };
  }

  // Build initial prompt with telegram-agent identity
  let initialPrompt = '';
  const botConfig = getBotByRole(name);
  if (botConfig) {
    initialPrompt = `"/telegram-agent --name ${botConfig.name} --who \\"${persona || botConfig.role}\\""`;
  }

  // Determine skills to load:
  // 1. If role provided, load role skill (it will lazy-load references)
  // 2. Fall back to config skills
  // 3. Fall back to options skills
  let skillsToLoad: string[] = [];

  if (role && isRoleSkill(role)) {
    // Load role skill - referenced skills are lazy-loaded on invocation
    skillsToLoad = [role];
  } else {
    // Legacy behavior: use explicit skills from config or options
    const configSkills = botConfig?.agent_config?.skills || [];
    skillsToLoad = skills && skills.length > 0 ? skills : configSkills;
  }

  // Start Claude with CLAUDECODE unset (workaround for nested sessions)
  const startCmd = `env -u CLAUDECODE claude --dangerously-skip-permissions --model ${model} ${initialPrompt}`;
  execSync(`tmux send-keys -t ${sessionName} '${startCmd}' Enter`);

  // Minimal wait for tmux to process
  execSync('sleep 1');

  // Configure agent if persona provided (legacy agent-setup)
  if (persona) {
    let agentCmd = `/agent-setup --who "${persona}" --response-style ${style}`;
    if (memoryFile) {
      agentCmd += ` --memory ${memoryFile}`;
    }
    execSync(`tmux send-keys -t ${sessionName} '${agentCmd}' Enter`);
    execSync('sleep 2');
  }

  // Load skills - wait for each to fully load before injecting next
  for (const skill of skillsToLoad) {
    execSync(`tmux send-keys -t ${sessionName} '/${skill}' Enter`);
    waitForSkillLoad(sessionName, skill);
  }

  return { sessionName, status: 'spawned' };
}
```

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit lib/spawn-agent.ts`
Expected: No errors

**Step 5: Commit**

```bash
git add lib/spawn-agent.ts
git commit -m "feat(spawn): add role skill support with lazy-loading"
```

---

## Task 12: Update Orchestrator to Use New Config

**Files:**
- Modify: `lib/orchestrator.ts`

**Step 1: Import role loader**

Add import at top of `lib/orchestrator.ts`:

```typescript
import { getReferencedSkills } from './role-loader.js';
```

**Step 2: Update agent spawning logic**

Find the section where agents are spawned and update to use role_skill:

```typescript
// In the agent spawning section, update to:
const roleSkill = botConfig.agent_config?.role_skill;
if (roleSkill) {
  spawnAgent({
    name: botConfig.role,
    persona: botConfig.agent_config?.persona,
    role: roleSkill,
    memoryFile: botConfig.agent_config?.memory,
    model: 'sonnet'
  });
}
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit lib/orchestrator.ts`
Expected: No errors

**Step 4: Commit**

```bash
git add lib/orchestrator.ts
git commit -m "feat(orchestrator): use role_skill from config for spawning"
```

---

## Task 13: Update CLI to Support Role Flag

**Files:**
- Modify: `bin/cc-orch.ts`

**Step 1: Add role option to spawn command**

Update the spawn command in `bin/cc-orch.ts`:

```typescript
// In the spawn command section, add --role option:
program
  .command('spawn <name>')
  .description('Spawn an agent')
  .option('--role <role>', 'Role skill to load (e.g., backend-developer)')
  .option('--persona <persona>', 'Persona to use (default: telegram-agent)')
  .option('--model <model>', 'Model to use (sonnet/opus/haiku)')
  .action((name, options) => {
    const result = spawnAgent({
      name,
      role: options.role,
      persona: options.persona,
      model: options.model || 'sonnet'
    });
    console.log(JSON.stringify(result, null, 2));
  });
```

**Step 2: Test CLI help**

Run: `npx tsx bin/cc-orch.ts spawn --help`
Expected: Shows --role and --persona options

**Step 3: Commit**

```bash
git add bin/cc-orch.ts
git commit -m "feat(cli): add --role and --persona options to spawn command"
```

---

## Task 14: Integration Test

**Files:**
- Test: Manual testing

**Step 1: Test persona loading**

Run: `npx tsx -e "import { loadPersona } from './lib/persona-loader.js'; console.log(loadPersona('telegram-agent'));"`Expected: Persona config object printed

**Step 2: Test role loading**

Run: `npx tsx -e "import { loadRole, getReferencedSkills } from './lib/role-loader.js'; console.log(getReferencedSkills('backend-developer'));"`Expected: Array of skill names ['dev-test', 'review-code', 'plan-execute', 'db-expert']

**Step 3: Test spawn with role**

Run: `npx tsx bin/cc-orch.ts spawn backend --role backend-developer`
Expected: Agent spawns with role skill loaded

**Step 4: Verify in tmux**

Run: `tmux capture-pane -t cc-backend -p`
Expected: See role skill loaded in output

**Step 5: Clean up test session**

Run: `tmux kill-session -t cc-backend 2>/dev/null || true`

---

## Summary

**Files Created:**
- `.claude/personas/telegram-agent.yaml`
- `.claude/skills/backend-developer/SKILL.md`
- `.claude/skills/frontend-developer/SKILL.md`
- `.claude/skills/qa-developer/SKILL.md`
- `.claude/skills/orchestrator-developer/SKILL.md`
- `config/agents.yaml`
- `lib/persona-loader.ts`
- `lib/role-loader.ts`

**Files Modified:**
- `lib/orchestration-config.ts` - Added persona/role_skill to interface
- `config/orchestration.yml` - Added persona/role_skill to bot configs
- `lib/spawn-agent.ts` - Added role skill support
- `lib/orchestrator.ts` - Use role_skill for spawning
- `bin/cc-orch.ts` - Added --role and --persona CLI options

**Key Changes:**
1. Persona files define communication channel and auto-loaded skills
2. Role skills define domain knowledge and referenced skills
3. Referenced skills lazy-load on first invocation
4. Spawn command supports `--role` flag for role-based spawning
5. Config links agents to persona + role combinations
