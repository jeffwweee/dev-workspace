# Phase 1: Foundation - Orchestrator Overhaul

> **For Claude:** REQUIRED SUB-SKILL: Use `executing-plans` or `plan-parallel` skill to implement this plan task-by-task.

**Goal:** Set up the foundational directory structure, configuration, and agent spawning capability.

**Architecture:** Create `lib/` for TypeScript libraries, `state/` subdirectories for file-based state, unified `config/orchestration.yml`, and spawn-agent.ts with CLAUDECODE workaround.

**Tech Stack:** TypeScript, YAML, tmux

---

## Task 1.1: Create Directory Structure

**Files:**
- Create: `lib/` (directory)
- Create: `state/memory/` (directory)
- Create: `state/progress/` (directory)
- Create: `state/pending/` (directory)
- Create: `state/log/` (directory)
- Create: `state/rss/` (directory)

**Step 1: Create directories**

```bash
mkdir -p lib state/memory state/progress state/pending state/log state/rss
```

**Step 2: Add .gitkeep files**

```bash
touch lib/.gitkeep state/memory/.gitkeep state/progress/.gitkeep state/pending/.gitkeep state/log/.gitkeep state/rss/.gitkeep
```

**Step 3: Verify structure**

Run: `ls -la lib state/`
Expected: Directories exist with .gitkeep files

**Step 4: Commit**

```bash
git add lib/ state/
git commit -m "feat(orchestrator): create directory structure for v4 overhaul"
```

---

## Task 1.2: Create config/orchestration.yml

**Files:**
- Create: `config/orchestration.yml`

**Step 1: Write orchestration config**

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

**Step 2: Verify file exists**

Run: `cat config/orchestration.yml`
Expected: YAML content displayed

**Step 3: Commit**

```bash
git add config/orchestration.yml
git commit -m "feat(orchestrator): add unified orchestration configuration"
```

---

## Task 1.3: Create lib/spawn-agent.ts

**Files:**
- Create: `lib/spawn-agent.ts`
- Create: `lib/__tests__/spawn-agent.test.ts`

**Step 1: Install dependencies**

```bash
npm install --save-dev tsx jest @types/node
```

**Step 2: Write spawn-agent.ts**

```typescript
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface SpawnOptions {
  name: string;
  persona?: string;
  skills?: string[];
  memoryFile?: string;
  isAdhoc?: boolean;
}

export interface SpawnResult {
  sessionName: string;
  status: 'spawned' | 'already_exists' | 'error';
  error?: string;
}

export const CORE_AGENTS = ['backend', 'frontend', 'qa', 'review-git'] as const string[];

/**
 * Spawns a Claude Code agent in a tmux session
 * Uses CLAUDECODE workaround to allow nested Claude Code sessions
 */
export function spawnAgent(options: SpawnOptions): SpawnResult {
  const {
    name,
    persona,
    skills = [],
    memoryFile,
    isAdhoc = false
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

  // Start Claude with CLAUDECODE unset (workaround for nested sessions)
  const startCmd = 'env -u CLAUDECODE claude';
  execSync(`tmux send-keys -t ${sessionName} '${startCmd}' Enter`);

  // Wait for startup
  execSync('sleep 5');

  // Configure agent if persona provided
  if (persona) {
    let agentCmd = `/agent-setup --who "${persona}"`;
    if (memoryFile) {
    agentCmd += ` --memory ${memoryFile}`;
  }
    execSync(`tmux send-keys -t ${sessionName} '${agentCmd}' Enter`);
    execSync('sleep 2');
  }

  // Load skills
  for (const skill of skills) {
    execSync(`tmux send-keys -t ${sessionName} '/skill ${skill}' Enter`);
    execSync('sleep 1');
  }

  return { sessionName, status: 'spawned' };
}

/**
 * Kills an agent's tmux session
 */
export function killAgent(name: string, isAdhoc = false): SpawnResult {
  const sessionName = isAdhoc ? `cc-adhoc-${name}` : `cc-${name}`;

  try {
    execSync(`tmux kill-session -t ${sessionName} 2>/dev/null || true`);
    return { sessionName, status: 'spawned' }; // 'spawned' means 'killed' in this context
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { sessionName, status: 'error', error: message };
  }
}

/**
 * Checks if an agent session is running
 */
export function isAgentRunning(name: string, isAdhoc = false): boolean {
  const sessionName = isAdhoc ? `cc-adhoc-${name}` : `cc-${name}`;

  try {
    execSync(`tmux has-session -t ${sessionName} 2>/dev/null`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sends a command to an agent session
 */
export function sendToAgent(name: string, command: string, isAdhoc = false): void {
  const sessionName = isAdhoc ? `cc-adhoc-${name}` : `cc-${name}`;
  execSync(`tmux send-keys -t ${sessionName} '${command}' Enter`);
}

/**
 * Lists all running agent sessions
 */
export function listAgentSessions(): string[] {
  try {
    const output = execSync('tmux list-sessions -F "#{session_name}" 2>/dev/null').toString();
    return output.trim().split('\n').filter(s => s.startsWith('cc-'));
  } catch {
    return [];
  }
}

/**
 * Gets list of core agent names
 */
export function getCoreAgents(): string[] {
  return [...CORE_AGENTS];
}
```

**Step 3: Write test file**

`lib/__tests__/spawn-agent.test.ts`:
```typescript
import {
  spawnAgent,
  killAgent,
  isAgentRunning,
  listAgentSessions,
  getCoreAgents
} from '../spawn-agent';

// Note: These tests require tmux to be installed

describe('spawn-agent', () => {
  const testAgent = 'test-spawn-agent';

  afterAll(() => {
    // Cleanup: kill test agent if running
    try {
      killAgent(testAgent, true);
    } catch {
      // Ignore cleanup errors
    }
  });

  test('getCoreAgents returns expected agents', () => {
    const agents = getCoreAgents();
    expect(agents).toContain('backend');
    expect(agents).toContain('frontend');
    expect(agents).toContain('qa');
    expect(agents).toContain('review-git');
  });

  test('spawnAgent creates a new session', () => {
    const result = spawnAgent({
      name: testAgent,
      isAdhoc: true
    });

    expect(result.status).toBe('spawned');
    expect(result.sessionName).toBe(`cc-adhoc-${testAgent}`);
  });

  test('isAgentRunning detects running agent', () => {
    const running = isAgentRunning(testAgent, true);
    expect(running).toBe(true);
  });

  test('listAgentSessions includes spawned agent', () => {
    const sessions = listAgentSessions();
    expect(sessions).toContain(`cc-adhoc-${testAgent}`);
  });

  test('killAgent removes the session', () => {
    const result = killAgent(testAgent, true);
    expect(result.status).toBe('spawned');

    const running = isAgentRunning(testAgent, true);
    expect(running).toBe(false);
  });
});
```

**Step 4: Run tests**

Run: `npx jest lib/__tests__/spawn-agent.test.ts`
Expected: All tests pass

**Step 5: Commit**

```bash
git add lib/spawn-agent.ts lib/__tests__/
git commit -m "feat(orchestrator): add agent spawning library with CLAUDECODE workaround"
```

---

## Task 1.4: Create Memory File Templates

**Files:**
- Create: `state/primary.md`
- Create: `state/memory/backend.md`
- Create: `state/memory/frontend.md`
- Create: `state/memory/qa.md`
- Create: `state/memory/review-git.md`

**Step 1: Write primary.md**

```markdown
# Primary Orchestrator Memory

## Essential Context
- Orchestrator manages core agents: backend, frontend, qa, review-git
- Each agent runs in dedicated tmux session
- CLAUDECODE workaround required for spawning: `env -u CLAUDECODE claude`

## Active Tasks
<!-- Format: TASK-XXX | Agent | Status | Started -->

## Recent Completions
<!-- Last 10 completed tasks -->

## Learnings
<!-- Patterns extracted from agent handoffs -->

## Metrics
- Tasks completed: 0
- Average task duration: N/A
- Review pass rate: N/A
```

**Step 2: Write agent memory templates**

`state/memory/backend.md`:
```markdown
# Backend Agent Memory

## Essential Context
- Focus: Backend/API development, database operations
- Languages: TypeScript, Node.js, Python
- Skills: dev-test, review-code

## Learned Patterns
<!-- What worked, what didn't -->

## Recent Tasks
<!-- Last 5 completed tasks -->

## Error Resolutions
<!-- Successful error fixes -->
```

`state/memory/frontend.md`:
```markdown
# Frontend Agent Memory

## Essential Context
- Focus: Frontend/UI development, React, Vue, CSS
- Skills: dev-test, review-code

## Learned Patterns

## Recent Tasks

## Error Resolutions
```

`state/memory/qa.md`:
```markdown
# QA Agent Memory

## Essential Context
- Focus: Testing, verification, E2E tests
- Skills: dev-test, review-verify

## Learned Patterns

## Test Strategies

## Recent Tasks

## Error Resolutions
```

`state/memory/review-git.md`:
```markdown
# Review-Git Agent Memory

## Essential Context
- Focus: Code review, security, git operations
- Outputs: confidence_score, commit_hash
- Skills: review-code, dev-git

## Review Criteria
<!-- Quality standards enforced -->

## Common Issues Found
<!-- Patterns of issues detected -->

## Recent Reviews
<!-- Last 10 reviews with confidence scores -->
```

**Step 3: Verify files**

Run: `ls -la state/memory/`
Expected: All memory files exist

**Step 4: Commit**

```bash
git add state/primary.md state/memory/
git commit -m "feat(orchestrator): add memory file templates"
```

---

## Task 1.5: Create Queue File Templates

**Files:**
- Create: `state/pending/backend.json`
- Create: `state/pending/frontend.json`
- Create: `state/pending/qa.json`
- Create: `state/pending/review-git.json`

**Step 1: Write queue files**

```bash
cat > state/pending/backend.json << 'EOF'
{
  "agent": "backend",
  "max_length": 3,
  "tasks": []
}
EOF

cat > state/pending/frontend.json << 'EOF'
{
  "agent": "frontend",
  "max_length": 3,
  "tasks": []
}
EOF

cat > state/pending/qa.json << 'EOF'
{
  "agent": "qa",
  "max_length": 3,
  "tasks": []
}
EOF

cat > state/pending/review-git.json << 'EOF'
{
  "agent": "review-git",
  "max_length": 3,
  "tasks": []
}
EOF
```

**Step 2: Verify**

Run: `cat state/pending/backend.json`
Expected: JSON content with empty tasks array

**Step 3: Commit**

```bash
git add state/pending/
git commit -m "feat(orchestrator): add agent queue files"
```

---

## Task 1.6: Create RSS Queue Files

**Files:**
- Create: `state/rss/queue.json`
- Create: `state/rss/processed.json`

**Step 1: Write RSS queue files**

```bash
cat > state/rss/queue.json << 'EOF'
[]
EOF

cat > state/rss/processed.json << 'EOF'
{
  "lastUpdated": null,
  "items": []
}
EOF
```

**Step 2: Verify**

Run: `cat state/rss/queue.json`
Expected: Empty array `[]`

**Step 3: Commit**

```bash
git add state/rss/
git commit -m "feat(orchestrator): add RSS queue files"
```

---

## Phase 1 Complete Checklist

- [ ] Directory structure created (`lib/`, `state/memory/`, etc.)
- [ ] `config/orchestration.yml` created with all bots and workflows
- [ ] `lib/spawn-agent.ts` created with CLAUDECODE workaround
- [ ] Memory file templates created
- [ ] Queue file templates created
- [ ] RSS queue files created

**Next Phase:** Phase 2 - Core Libraries (queue-manager, memory-manager, handoff, orchestrator)
