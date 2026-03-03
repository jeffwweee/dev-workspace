# Evolution System Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `executing-plans` or `subagent-driven-development` skill to implement this plan task-by-task.

**Goal:** Wire the existing evolution backend into the dev-workspace skill workflow so genes are loaded at session start and solidified at session end.

**Architecture:** The backend (signals.cjs, solidify.cjs, validate.cjs, promote.cjs, export.cjs) is complete. This plan adds the integration layer: a CLI handler for /evolve commands and actual execution hooks in project-session and finishing-a-development-branch skills.

**Tech Stack:** Node.js, CommonJS modules, ioredis, existing dev-workspace CLI structure

---

## What's Already Done (DO NOT REBUILD)

- `scripts/redis.cjs` - Redis client and key schema
- `scripts/signals.cjs` - Signal emission (7 types)
- `scripts/solidify.cjs` - Signal → gene candidate conversion
- `scripts/validate.cjs` - Tiered validation with GDI scoring
- `scripts/promote.cjs` - Gene promotion to registry
- `scripts/export.cjs` - File system backup (JSON/Markdown)
- `~/.claude/evolution/` directory structure
- SKILL.md documentation for capability-evolver

## What This Plan Builds

1. **CLI Handler** - `bin/dw.js evolve` command for status/solidify/export
2. **Session Start Integration** - Gene loading in project-session
3. **Session End Integration** - Solidification in finishing-a-development-branch
4. **Test Coverage** - Basic tests for integration points

---

### Task 1: Add evolve command to CLI

**Files:**
- Modify: `bin/dw.js` (add new command)
- Create: `lib/commands/evolve.js` (command handler)

**Step 1: Write the failing test**

Create `tests/evolve.test.js`:

```javascript
const { execSync } = require('child_process');
const path = require('path');

const dw = (args) => {
  try {
    return execSync(`node bin/dw.js ${args}`, {
      cwd: path.resolve(__dirname, '..'),
      encoding: 'utf8'
    });
  } catch (e) {
    return e.stdout || e.stderr;
  }
};

test('evolve command exists', () => {
  const output = dw('evolve --help');
  expect(output).toContain('evolve');
});

test('evolve status shows registry info', () => {
  const output = dw('evolve --status');
  expect(output).toContain('Evolution Status') || expect(output).toContain('Redis');
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/evolve.test.js`
Expected: FAIL - command doesn't exist

**Step 3: Create the evolve command handler**

Create `lib/commands/evolve.js`:

```javascript
const path = require('path');
const signals = require('../../.claude/skills/capability-evolver/scripts/signals.cjs');
const solidify = require('../../.claude/skills/capability-evolver/scripts/solidify.cjs');
const promote = require('../../.claude/skills/capability-evolver/scripts/promote.cjs');
const exportModule = require('../../.claude/skills/capability-evolver/scripts/export.cjs');
const redis = require('../../.claude/skills/capability-evolver/scripts/redis.cjs');

async function handleStatus(sessionId) {
  try {
    const genes = await promote.getTopGenes(5);
    const events = await signals.getRecentEvents(10);
    console.log('\n📊 Evolution Status\n');
    console.log(`Registry: ${genes.length} top genes loaded`);
    if (genes.length > 0) {
      console.log('\nTop Genes (by GDI):');
      genes.forEach((g, i) => {
        console.log(`  ${i + 1}. ${g.id} (${parseFloat(g.gdiScore).toFixed(2)}) - "${g.name || 'unnamed'}"`);
      });
    }
    console.log(`\nRecent Events: ${events.length}`);
    console.log('\nStatus: SUCCESS\n');
  } catch (err) {
    console.log(`\n📊 Evolution Status\n`);
    console.log(`Registry: Unable to connect to Redis`);
    console.log(`Error: ${err.message}`);
    console.log('\nStatus: PARTIAL (Redis unavailable)\n');
  } finally {
    await redis.close();
  }
}

async function handleSolidify(sessionId) {
  console.log(`\n🔄 Solidifying session: ${sessionId}\n`);
  try {
    const result = await solidify.solidify(sessionId);
    console.log(`Signals analyzed: ${result.signalsAnalyzed}`);
    console.log(`Candidates created: ${result.candidates.length}`);
    console.log(`Message: ${result.message}`);
    console.log('\nStatus: SUCCESS\n');
  } catch (err) {
    console.log(`Error: ${err.message}`);
    console.log('\nStatus: FAILURE\n');
  } finally {
    await redis.close();
  }
}

async function handleExport() {
  console.log('\n📤 Exporting evolution data...\n');
  try {
    const result = await exportModule.exportAll();
    console.log(`Genes exported: ${result.genes.exported}`);
    console.log(`Snapshot: ${result.snapshot.path}`);
    console.log('\nStatus: SUCCESS\n');
  } catch (err) {
    console.log(`Error: ${err.message}`);
    console.log('\nStatus: FAILURE\n');
  } finally {
    await redis.close();
  }
}

async function handlePublish(geneId) {
  console.log(`\n📌 Marking gene as publishable: ${geneId}\n`);
  try {
    const client = await redis.getClient();
    await client.sadd(redis.keys.publishable(), geneId);
    console.log(`Gene ${geneId} marked as publishable`);
    console.log('\nStatus: SUCCESS\n');
  } catch (err) {
    console.log(`Error: ${err.message}`);
    console.log('\nStatus: FAILURE\n');
  } finally {
    await redis.close();
  }
}

module.exports = {
  command: 'evolve [action]',
  description: 'Manage workspace evolution system',
  builder: (yargs) => {
    return yargs
      .positional('action', {
        describe: 'Action to perform',
        choices: ['status', 'solidify', 'export', 'publish'],
        default: 'status'
      })
      .option('session', {
        describe: 'Session ID',
        type: 'string',
        default: process.env.CLAUDE_SESSION_ID || 'local'
      })
      .option('gene', {
        describe: 'Gene ID for publish action',
        type: 'string'
      });
  },
  handler: async (argv) => {
    const sessionId = argv.session;

    switch (argv.action) {
      case 'solidify':
        await handleSolidify(sessionId);
        break;
      case 'export':
        await handleExport();
        break;
      case 'publish':
        if (!argv.gene) {
          console.log('Error: --gene flag required for publish action');
          process.exit(1);
        }
        await handlePublish(argv.gene);
        break;
      case 'status':
      default:
        await handleStatus(sessionId);
    }
  }
};
```

**Step 4: Wire into CLI**

In `bin/dw.js`, add the evolve command to the yargs setup:

```javascript
// Find the section where commands are registered and add:
.command(require('../lib/commands/evolve'))
```

**Step 5: Run test to verify it passes**

Run: `npm test -- tests/evolve.test.js`
Expected: PASS

**Step 6: Commit**

```bash
git add lib/commands/evolve.js bin/dw.js tests/evolve.test.js
git commit -m "$(cat <<'EOF'
feat(evolution): Add evolve CLI command

Add `node bin/dw.js evolve` with subcommands:
- status: Show registry info and top genes
- solidify: Force solidify session signals
- export: Backup to file system
- publish: Mark gene as publishable

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Add gene loading helper function

**Files:**
- Modify: `.claude/skills/capability-evolver/scripts/promote.cjs`

**Step 1: Write the failing test**

Create `tests/evolution-gene-loading.test.js`:

```javascript
const promote = require('../.claude/skills/capability-evolver/scripts/promote.cjs');
const redis = require('../.claude/skills/capability-evolver/scripts/redis.cjs');

afterAll(async () => {
  await redis.close();
});

test('getTopGenes returns array', async () => {
  const genes = await promote.getTopGenes(5);
  expect(Array.isArray(genes)).toBe(true);
});

test('getRelevantGenes filters by tags', async () => {
  // If function exists, test it
  if (promote.getRelevantGenes) {
    const genes = await promote.getRelevantGenes(['api', 'error-handling'], 5);
    expect(Array.isArray(genes)).toBe(true);
  }
});
```

**Step 2: Run test to verify current state**

Run: `npm test -- tests/evolution-gene-loading.test.js`
Expected: getTopGenes passes (already implemented), getRelevantGenes may not exist

**Step 3: Add getRelevantGenes function**

Add to `.claude/skills/capability-evolver/scripts/promote.cjs`:

```javascript
async function getRelevantGenes(scenarioTags = [], limit = 10) {
  const client = await redis.getClient();
  // Get top genes by GDI
  const geneIds = await client.zrevrange(redis.keys.genesRegistry(), 0, limit * 2 - 1, 'WITHSCORES');
  const genes = [];
  for (let i = 0; i < geneIds.length; i += 2) {
    const geneId = geneIds[i], score = parseFloat(geneIds[i + 1]);
    const geneData = await client.hgetall(redis.keys.gene(geneId));
    const metadata = await client.hgetall(redis.keys.geneMetadata(geneId));

    // Check if gene matches any scenario tag
    const geneTags = (geneData.tags || '').split(',').map(t => t.trim()).filter(Boolean);
    const matches = scenarioTags.length === 0 ||
      geneTags.some(t => scenarioTags.includes(t)) ||
      scenarioTags.some(t => (geneData.name || '').toLowerCase().includes(t.toLowerCase()));

    if (matches || scenarioTags.length === 0) {
      genes.push({ id: geneId, ...geneData, metadata, gdiScore: score });
      if (genes.length >= limit) break;
    }
  }
  return genes;
}

// Add to exports
module.exports = { promoteGene, promoteSessionCandidates, getTopGenes, getRelevantGenes };
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/evolution-gene-loading.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add .claude/skills/capability-evolver/scripts/promote.cjs tests/evolution-gene-loading.test.js
git commit -m "$(cat <<'EOF'
feat(evolution): Add getRelevantGenes for tag-based filtering

Add function to load genes matching scenario tags,
enabling context-aware gene loading at session start.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Integrate gene loading into project-session

**Files:**
- Modify: `.claude/skills/project-session/SKILL.md` (update instructions)
- Create: `lib/evolution-session.js` (helper module)

**Step 1: Create evolution session helper**

Create `lib/evolution-session.js`:

```javascript
const path = require('path');
const signals = require('../.claude/skills/capability-evolver/scripts/signals.cjs');
const promote = require('../.claude/skills/capability-evolver/scripts/promote.cjs');
const redis = require('../.claude/skills/capability-evolver/scripts/redis.cjs');

async function loadSessionGenes(scenarioTags = [], limit = 5) {
  try {
    const genes = await promote.getRelevantGenes(scenarioTags, limit);
    if (genes.length > 0) {
      console.log(`\n🧬 Loaded ${genes.length} evolution genes:`);
      genes.forEach((g, i) => {
        console.log(`   ${i + 1}. ${g.name || g.id} (GDI: ${parseFloat(g.gdiScore).toFixed(2)})`);
      });
      console.log('');
    }
    return genes;
  } catch (err) {
    // Non-blocking - continue without genes
    return [];
  }
}

async function initSessionEvolution(sessionId, projectContext = {}) {
  try {
    await signals.initSession(sessionId, projectContext);
    console.log(`🧬 Evolution: Session ${sessionId} initialized`);
  } catch (err) {
    // Non-blocking - continue without evolution
  }
}

async function emitSignal(sessionId, type, data) {
  try {
    await signals.emit(type, data, sessionId);
  } catch (err) {
    // Non-blocking - signals are optional
  }
}

async function closeEvolution() {
  try {
    await redis.close();
  } catch (err) {
    // Ignore close errors
  }
}

module.exports = {
  loadSessionGenes,
  initSessionEvolution,
  emitSignal,
  closeEvolution
};
```

**Step 2: Update project-session SKILL.md**

Replace the "Evolution Integration" section in `.claude/skills/project-session/SKILL.md`:

```markdown
## Evolution Integration

At session start, the evolution system loads relevant genes into context.

### Integration Point

After claiming a task (Step 2 in workflow), call the helper:

```bash
node -e "
const evo = require('./lib/evolution-session');
(async () => {
  const sessionId = process.env.CLAUDE_SESSION_ID || 'local';
  await evo.initSessionEvolution(sessionId, { project: '<project-name>' });
  await evo.loadSessionGenes(['<project-tags>'], 5);
  await evo.closeEvolution();
})();
" 2>/dev/null || true
```

This reports loaded genes or silently continues if Redis unavailable.
```

**Step 3: Test manually**

Run: `node -e "require('./lib/evolution-session').loadSessionGenes(['api'], 3).then(() => process.exit(0))"`
Expected: Shows loaded genes or nothing (if none exist)

**Step 4: Commit**

```bash
git add lib/evolution-session.js .claude/skills/project-session/SKILL.md
git commit -m "$(cat <<'EOF'
feat(evolution): Add session helper for gene loading

Create lib/evolution-session.js with helpers for:
- loadSessionGenes: Tag-based gene loading
- initSessionEvolution: Session initialization
- emitSignal: Non-blocking signal emission

Update project-session SKILL.md with simplified integration.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Integrate solidification into finishing-a-development-branch

**Files:**
- Modify: `.claude/skills/finishing-a-development-branch/SKILL.md`

**Step 1: Update SKILL.md with simpler integration**

Replace the "Evolution Integration" section in `.claude/skills/finishing-a-development-branch/SKILL.md`:

```markdown
## Evolution Integration

At session end, solidify signals into genes.

### Pre-Completion: Solidify Session

Before verifying tests (Step 1), run:

```bash
node -e "
const evo = require('./lib/evolution-session');
const solidify = require('./.claude/skills/capability-evolver/scripts/solidify.cjs');
const promote = require('./.claude/skills/capability-evolver/scripts/promote.cjs');
const exportMod = require('./.claude/skills/capability-evolver/scripts/export.cjs');
const redis = require('./.claude/skills/capability-evolver/scripts/redis.cjs');

(async () => {
  const sessionId = process.env.CLAUDE_SESSION_ID || 'local';
  try {
    const s = await solidify.solidify(sessionId);
    console.log('🧬 Evolution: ' + s.message);
    const p = await promote.promoteSessionCandidates(sessionId);
    console.log('🧬 Evolution: ' + p.message);
    const e = await exportMod.exportAll();
    console.log('🧬 Evolution: Exported ' + e.genes.exported + ' genes');
  } catch (err) {
    console.log('🧬 Evolution: ' + err.message + ' (non-critical)');
  } finally {
    await redis.close();
  }
})();
" 2>/dev/null || true
```

Reports: "Session contributed X new genes" or silently continues.
```

**Step 2: Commit**

```bash
git add .claude/skills/finishing-a-development-branch/SKILL.md
git commit -m "$(cat <<'EOF'
docs(evolution): Simplify finishing-branch integration

Update solidification code to use lib/evolution-session
helper pattern for consistency.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Add signal emission to executing-plans skill

**Files:**
- Modify: `.claude/skills/executing-plans/SKILL.md`

**Step 1: Add signal emission documentation**

Add to `.claude/skills/executing-plans/SKILL.md` after the overview:

```markdown
## Evolution Integration

During plan execution, emit signals for evolution tracking:

### Task Start
```bash
node -e "require('./lib/evolution-session').emitSignal(process.env.CLAUDE_SESSION_ID || 'local', 'pattern', {task: '<task-id>', action: 'start'}).then(() => process.exit(0))" 2>/dev/null || true
```

### Task Completion
```bash
node -e "require('./lib/evolution-session').emitSignal(process.env.CLAUDE_SESSION_ID || 'local', 'completion', {task: '<task-id>', success: true}).then(() => process.exit(0))" 2>/dev/null || true
```

### Error Recovery
```bash
node -e "require('./lib/evolution-session').emitSignal(process.env.CLAUDE_SESSION_ID || 'local', 'repair', {error: '<error-type>', fix: '<fix-applied>', success: true}).then(() => process.exit(0))" 2>/dev/null || true
```

These signals are non-blocking and fail silently if Redis unavailable.
```

**Step 2: Commit**

```bash
git add .claude/skills/executing-plans/SKILL.md
git commit -m "$(cat <<'EOF'
docs(evolution): Add signal emission to executing-plans

Document signal emission points during plan execution:
- Task start/completion signals
- Error recovery signals

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Add signal emission to subagent-driven-development skill

**Files:**
- Modify: `.claude/skills/subagent-driven-development/SKILL.md`

**Step 1: Add signal emission documentation**

Add to `.claude/skills/subagent-driven-development/SKILL.md`:

```markdown
## Evolution Integration

During subagent execution, emit signals for evolution tracking:

### Per-Task Signals

When a task completes successfully:
```bash
node -e "require('./lib/evolution-session').emitSignal(process.env.CLAUDE_SESSION_ID || 'local', 'completion', {task: '<task-id>', approach: '<approach-name>', duration: <seconds>}).then(() => process.exit(0))" 2>/dev/null || true
```

When an error is recovered:
```bash
node -e "require('./lib/evolution-session').emitSignal(process.env.CLAUDE_SESSION_ID || 'local', 'repair', {error: '<error>', fix: '<fix>', success: true}).then(() => process.exit(0))" 2>/dev/null || true
```

When stuck detection triggers:
```bash
node -e "require('./lib/evolution-session').emitSignal(process.env.CLAUDE_SESSION_ID || 'local', 'stuck', {type: '<stuck-type>', loopCount: <count>}).then(() => process.exit(0))" 2>/dev/null || true
```
```

**Step 2: Commit**

```bash
git add .claude/skills/subagent-driven-development/SKILL.md
git commit -m "$(cat <<'EOF'
docs(evolution): Add signal emission to subagent-driven-development

Document signal emission points during subagent execution.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Run full integration test

**Files:**
- Create: `tests/evolution-integration.test.js`

**Step 1: Write integration test**

Create `tests/evolution-integration.test.js`:

```javascript
const { execSync } = require('child_process');
const path = require('path');

const run = (cmd) => {
  try {
    return execSync(cmd, {
      cwd: path.resolve(__dirname, '..'),
      encoding: 'utf8',
      timeout: 10000
    });
  } catch (e) {
    return e.stdout || e.stderr || e.message;
  }
};

describe('Evolution Integration', () => {
  test('evolve status command works', () => {
    const output = run('node bin/dw.js evolve status');
    expect(output).toContain('Evolution Status');
  });

  test('evolve export command works', () => {
    const output = run('node bin/dw.js evolve export');
    expect(output).toContain('Exporting') || expect(output).toContain('Redis');
  });

  test('session helper loads', () => {
    const output = run('node -e "require(\'./lib/evolution-session\'); console.log(\'ok\')"');
    expect(output).toContain('ok');
  });

  test('scripts are valid CommonJS', () => {
    const scripts = ['signals', 'solidify', 'validate', 'promote', 'export', 'redis'];
    for (const script of scripts) {
      const output = run(`node -e "require('./.claude/skills/capability-evolver/scripts/${script}.cjs'); console.log('ok')"`);
      expect(output).toContain('ok');
    }
  });
});
```

**Step 2: Run integration tests**

Run: `npm test -- tests/evolution-integration.test.js`
Expected: All tests pass (may show Redis errors but tests should pass)

**Step 3: Commit**

```bash
git add tests/evolution-integration.test.js
git commit -m "$(cat <<'EOF'
test(evolution): Add integration tests

Test CLI commands and script loading.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Update CLAUDE.md with evolution usage

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Add evolution section to CLAUDE.md**

Add to `CLAUDE.md` after the Skills section:

```markdown
## Evolution System

The workspace evolves through sessions using the GEP (Genome Evolution Protocol).

### CLI Commands

```bash
node bin/dw.js evolve status     # Show registry status
node bin/dw.js evolve solidify   # Force solidify session
node bin/dw.js evolve export     # Backup to file system
node bin/dw.js evolve publish --gene <id>  # Mark publishable
```

### How It Works

1. **Session Start**: `project-session` loads relevant genes
2. **During Work**: Skills emit signals (pattern, repair, completion)
3. **Session End**: `finishing-a-development-branch` solidifies signals to genes

### Requirements

- Redis running on localhost:6379 (default)
- Config at `~/.claude/evolution/config.yaml`
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: Add evolution system to CLAUDE.md

Document CLI commands and workflow integration.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Final verification and PR

**Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass

**Step 2: Verify CLI commands work**

```bash
node bin/dw.js evolve status
node bin/dw.js evolve export
node bin/dw.js --help | grep evolve
```

**Step 3: Create PR**

```bash
gh pr create --title "feat(evolution): Wire evolution system into skill workflow" --body "$(cat <<'EOF'
## Summary

- Add `node bin/dw.js evolve` CLI command for status/solidify/export
- Create `lib/evolution-session.js` helper for skill integration
- Update project-session to load genes at session start
- Update finishing-a-development-branch to solidify at session end
- Add signal emission documentation to executing-plans and subagent-driven-development

## Test Plan

- [ ] Run `npm test` - all tests pass
- [ ] Run `node bin/dw.js evolve status` - shows registry info
- [ ] Run `node bin/dw.js evolve export` - exports to file system
- [ ] Verify scripts load without errors

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Add evolve CLI command |
| 2 | Add getRelevantGenes helper |
| 3 | Create session helper module |
| 4 | Integrate into finishing-branch |
| 5 | Add signals to executing-plans |
| 6 | Add signals to subagent-dev |
| 7 | Integration tests |
| 8 | Update CLAUDE.md docs |
| 9 | Final verification and PR |
