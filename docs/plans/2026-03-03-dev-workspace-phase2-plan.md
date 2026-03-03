# Dev-Workspace Phase 2 Plan

**Date:** 2026-03-03
**Status:** Draft
**Source:** ECC Analysis + Comparison Document

---

## Executive Summary

Phase 2 focuses on closing the gaps with ECC while preserving dev-workspace's unique multi-agent orchestration capabilities. Priority is given to high-impact, low-effort improvements.

---

## Gap Analysis

### Current State vs ECC

| Component | Dev-Workspace | ECC | Gap |
|-----------|--------------|-----|-----|
| Skills | 27 | 58 | -31 (domain coverage) |
| Commands | 2 | 36 | -34 (workflow shortcuts) |
| Rules | 0 | 30+ | -30 (language-specific) |
| MCP Configs | 0 | 17 | -17 (integrations) |
| Hooks | 1 | 10+ | -9 (automation) |
| Context Modes | 0 | 3 | -3 (dev/research/review) |
| Learning System | capability-evolver | continuous-learning-v2 | Different approaches |

### Dev-Workspace Unique Strengths (Preserve)

1. **Multi-Agent Orchestration** - No equivalent in ECC
2. **Telegram Gateway** - Production-grade bot routing
3. **File-Based State** - Git-trackable, debuggable
4. **Pipeline Workflows** - Automated stage routing

---

## Phase 2 Roadmap

### Sprint 1: Foundation (Week 1)

#### 1.1 Rules System
**Priority:** P1 | **Effort:** Low | **Impact:** High

Create `.claude/rules/` directory structure:

```
.claude/rules/
├── common/
│   ├── security.md          # Input validation, secrets handling
│   ├── git-workflow.md      # Conventional commits, branching
│   └── testing.md           # Test requirements
├── typescript/
│   ├── coding-style.md      # Naming, formatting
│   ├── patterns.md          # Preferred patterns
│   └── testing.md           # TS-specific testing
└── python/
    └── patterns.md          # Python conventions
```

**Tasks:**
- [ ] Create rules directory structure
- [ ] Port security.md from ECC
- [ ] Create TypeScript rules
- [ ] Add rules loading to session start

#### 1.2 MCP Configurations
**Priority:** P1 | **Effort:** Low | **Impact:** High

Create `config/mcp/` with essential integrations:

```
config/mcp/
├── github.json              # GitHub operations
├── context7.json            # Documentation lookup
├── memory.json              # Persistent memory
└── sequential-thinking.json # Chain-of-thought
```

**Tasks:**
- [ ] Create MCP config directory
- [ ] Add GitHub MCP config
- [ ] Add context7 MCP config
- [ ] Document MCP usage in CLAUDE.md

#### 1.3 Essential Commands
**Priority:** P1 | **Effort:** Low | **Impact:** Medium

Port high-value commands from ECC:

| Command | Purpose | Priority |
|---------|---------|----------|
| `/verify` | Pre-completion verification | P1 |
| `/checkpoint` | Save intermediate state | P1 |
| `/learn` | Extract patterns from session | P2 |

**Tasks:**
- [ ] Create `/verify` command
- [ ] Create `/checkpoint` command
- [ ] Create `/learn` command (optional)

---

### Sprint 2: Automation (Week 2)

#### 2.1 Hook System Expansion
**Priority:** P2 | **Effort:** Medium | **Impact:** Medium

Add hooks for automation:

```json
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Bash", "hook": "tmux-reminder" },
      { "matcher": "Bash", "hook": "git-push-review" }
    ],
    "PostToolUse": [
      { "matcher": "Edit", "hook": "auto-format" },
      { "matcher": "Edit", "hook": "typecheck" }
    ],
    "PreCompact": [
      { "matcher": "*", "hook": "save-state" }
    ]
  }
}
```

**Tasks:**
- [ ] Create hooks.json
- [ ] Add tmux reminder hook
- [ ] Add auto-format hook
- [ ] Add pre-compact state save

#### 2.2 Context Modes
**Priority:** P2 | **Effort:** Low | **Impact:** Medium

Add context mode files:

```
.claude/contexts/
├── dev.md        # Active development
├── review.md     # Code review mode
└── research.md   # Research/exploration
```

**Tasks:**
- [ ] Create contexts directory
- [ ] Add dev.md context
- [ ] Add review.md context
- [ ] Add research.md context

---

### Sprint 3: Evolution (Week 3)

#### 3.1 Continuous Learning Integration
**Priority:** P2 | **Effort:** Medium | **Impact:** High

Evaluate ECC's continuous-learning-v2 vs our capability-evolver:

| Feature | capability-evolver | continuous-learning-v2 |
|---------|-------------------|----------------------|
| Observation | Manual signals | Hook-based (100% coverage) |
| Granularity | Genes (complex) | Instincts (atomic) |
| Confidence | GDI score | 0.3-0.9 weighted |
| Evolution | Validation gates | Instinct → Cluster → Skill |

**Decision Options:**
1. **Port continuous-learning-v2** - More mature, hook-based
2. **Enhance capability-evolver** - Keep our approach, add hooks
3. **Hybrid** - Use instincts for patterns, genes for complex behaviors

**Tasks:**
- [ ] Evaluate both approaches
- [ ] Make architecture decision
- [ ] Implement chosen approach

#### 3.2 Strategic Compaction
**Priority:** P1 | **Effort:** Medium | **Impact:** High

Create strategic-compact skill to prevent mid-task state loss:

**Safe Compact Points:**
- After plan creation → before execution
- After task completion → before handoff
- After handoff → other agent has context

**Never Compact:**
- During implementation
- During debugging
- Mid-review

**Tasks:**
- [ ] Create strategic-compact skill
- [ ] Add compact state preservation
- [ ] Integrate with orchestrator loop

---

## Implementation Priority Matrix

| Priority | Component | Effort | Impact | Sprint |
|----------|-----------|--------|--------|--------|
| **P1** | Rules System | Low | High | 1 |
| **P1** | MCP Configs | Low | High | 1 |
| **P1** | /verify command | Low | Medium | 1 |
| **P1** | Strategic Compaction | Medium | High | 3 |
| **P2** | /checkpoint command | Low | Medium | 1 |
| **P2** | Hook System | Medium | Medium | 2 |
| **P2** | Context Modes | Low | Medium | 2 |
| **P2** | /learn command | Low | Medium | 1 |
| **P3** | Continuous Learning | Medium | High | 3 |

---

## Success Metrics

### Sprint 1 Success Criteria
- [ ] Rules directory created with 5+ rule files
- [ ] 4+ MCP configs available
- [ ] `/verify` command working
- [ ] `/checkpoint` command working

### Sprint 2 Success Criteria
- [ ] 5+ hooks active
- [ ] Context modes loadable
- [ ] Auto-format working for TS files

### Sprint 3 Success Criteria
- [ ] Strategic compaction prevents state loss
- [ ] Learning system decision made
- [ ] No mid-task compaction incidents

---

## Architecture Decisions

### ADR-001: Keep Telegram Gateway (Confirmed)
- **Decision:** Maintain Express gateway, don't migrate to MCP
- **Rationale:** Multi-agent routing, wake commands, reliability patterns
- **Status:** Confirmed in comparison document

### ADR-002: Rules Directory Structure
- **Decision:** Language-organized rules (common/, typescript/, python/)
- **Rationale:** Easier agent specialization, matches ECC pattern
- **Status:** To implement in Sprint 1

### ADR-003: MCP Config per Integration
- **Decision:** Separate JSON files per MCP server
- **Rationale:** Modular, can enable/disable per project
- **Status:** To implement in Sprint 1

### ADR-004: Hook System via hooks.json
- **Decision:** Centralized hooks.json in .claude/
- **Rationale:** Matches ECC, easy to manage
- **Status:** To implement in Sprint 2

---

## Files to Create

### Sprint 1
```
.claude/rules/common/security.md
.claude/rules/common/git-workflow.md
.claude/rules/common/testing.md
.claude/rules/typescript/coding-style.md
.claude/rules/typescript/patterns.md
.claude/commands/verify.md
.claude/commands/checkpoint.md
.claude/commands/learn.md
config/mcp/github.json
config/mcp/context7.json
config/mcp/memory.json
config/mcp/sequential-thinking.json
```

### Sprint 2
```
.claude/hooks/hooks.json
.claude/hooks/scripts/tmux-reminder.js
.claude/hooks/scripts/auto-format.js
.claude/hooks/scripts/pre-compact.js
.claude/contexts/dev.md
.claude/contexts/review.md
.claude/contexts/research.md
```

### Sprint 3
```
.claude/skills/strategic-compact/SKILL.md
.claude/skills/strategic-compact/index.ts
```

---

## Next Steps

1. **Immediate:** Create rules directory and port security.md
2. **This Week:** Complete Sprint 1 items (rules, MCP, commands)
3. **Next Week:** Sprint 2 (hooks, contexts)
4. **Week 3:** Sprint 3 (evolution, compaction)

---

## References

- ECC Repository: `~/jef/everything-claude-code`
- Comparison Document: `docs/learnings/2026-03-01-ecc-comparison-and-improvements.md`
- Current Skills: `.claude/skills/*/SKILL.md`
- Orchestration Config: `config/orchestration.yml`
