# Dev-Workspace Improvements Implementation Guide

**Date:** 2026-03-01
**Status:** Ready for Implementation

---

## Quick Start

This guide provides concrete implementation steps for the improvements identified from ECC comparison.

---

## P1: Strategic Compaction Skill

### Why
Prevents mid-task compaction that loses agent state in the orchestrator.

### Files to Create

**`.claude/skills/strategic-compact/SKILL.md`**

```markdown
---
name: strategic-compact
description: Suggests context compaction at optimal breakpoints to prevent state loss
---

## Purpose

Prevent mid-implementation compaction that loses agent state. Use this skill when:
- After completing a plan (before execution)
- After completing a task (before handoff)
- Context exceeds 100k tokens

## Compact Points (Safe)

| Point | Condition | Action |
|-------|-----------|--------|
| After Planning | Plan saved to file | Compact, then execute |
| After Task Complete | Work committed | Compact, then handoff |
| After Handoff | Other agent has context | Compact immediately |

## Never Compact (Unsafe)

| Point | Risk |
|-------|------|
| During Implementation | Loses in-progress code state |
| During Debugging | Loses investigation context |
| Mid-Review | Loses review findings |
| Active Agent | Loses current task context |

## Integration with Orchestrator

The orchestrator should call this skill at safe compact points:

```typescript
// In orchestrator.ts
async function handleTaskComplete(taskId: string, taskInfo: TaskInfo) {
  // Create handoff first
  const handoff = createHandoff({...});
  saveHandoff(handoff, taskId, taskInfo.agent, nextAgent);

  // Now safe to compact
  if (shouldCompact()) {
    console.log('[Orchestrator] Safe compact point detected');
    // Agent memory already saved to state/memory/{agent}.md
    // Progress already saved to state/progress/{taskId}.md
  }
}
```

## Usage

```bash
# Manual invocation
/skill strategic-compact

# Check if safe to compact
/skill strategic-compact --check
```

## Output

```
## Strategic Compact Analysis

**Current Context:** ~45,000 tokens
**Safe to Compact:** YES

**Reason:** Task completed, handoff created
**Saved State:**
- Memory: state/memory/backend.md
- Progress: state/progress/TASK-001.md
- Handoff: state/handoffs/TASK-001-backend-to-review-git.md

**Recommendation:** Run /compact now
```
```

### Integration Points

1. **Orchestrator Loop** - Call after task completion
2. **Plan-Execute Skill** - Call after plan creation
3. **Task-Complete Skill** - Call before finishing

---

## P1: MCP Configurations

### Why
Gives agents access to external tools without custom integrations.

### Files to Create

**`config/mcp/github.json`**

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

**`config/mcp/supabase.json`**

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-supabase"],
      "env": {
        "SUPABASE_URL": "${SUPABASE_URL}",
        "SUPABASE_ANON_KEY": "${SUPABASE_ANON_KEY}"
      }
    }
  }
}
```

**`config/mcp/exa-web-search.json`**

```json
{
  "mcpServers": {
    "exa-web-search": {
      "command": "npx",
      "args": ["-y", "exa-mcp-server"],
      "env": {
        "EXA_API_KEY": "${EXA_API_KEY}"
      }
    }
  }
}
```

**`config/mcp/context7.json`**

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-context7"]
    }
  }
}
```

### Usage in Skills

```markdown
<!-- In a skill that needs GitHub -->
## External Tools
This skill uses the GitHub MCP server. Ensure it's configured in config/mcp/github.json.

Available tools:
- github_search_repositories
- github_get_file_contents
- github_create_issue
- github_create_pull_request
```

---

## P2: /verify Command

### Why
Standardizes pre-completion verification across all agents.

### File to Create

**`.claude/commands/verify.md`**

```markdown
Run verification checks before claiming task complete.

Usage: /verify [options]

Options:
--type <type>     Verification type: all, tests, lint, types, build (default: all)
--fix             Auto-fix issues where possible
--strict          Fail on warnings
--ci              CI mode (exits with code)

Steps:

1. Detect project type (package.json, pyproject.toml, go.mod, etc.)

2. Run appropriate checks:

   **TypeScript/Node:**
   ```bash
   npm test
   npm run lint
   npm run typecheck
   npm run build
   ```

   **Python:**
   ```bash
   pytest
   ruff check .
   mypy .
   ```

   **Go:**
   ```bash
   go test ./...
   go vet ./...
   go build ./...
   ```

3. Report results in table format

Output:
## Verification Results

| Check | Status | Duration | Details |
|-------|--------|----------|---------|
| Tests | ✅ PASS | 12.3s | 45 passed, 0 failed |
| Lint | ✅ PASS | 2.1s | 0 errors, 2 warnings |
| Types | ✅ PASS | 3.4s | 0 errors |
| Build | ✅ PASS | 8.7s | Success |

**Overall:** ✅ READY FOR COMMIT

**Next Steps:**
1. Review any warnings
2. Run /review-code for final check
3. Commit changes
```

---

## P2: /learn Command

### Why
Feeds the evolution system with patterns from sessions.

### File to Create

**`.claude/commands/learn.md`**

```markdown
Extract patterns from current session for the evolution system.

Usage: /learn [options]

Options:
--category <cat>   Pattern category: code, workflow, debugging, architecture
--save             Save to learning system (state/learning/)
--review           Review before saving
--from <file>      Extract from specific file or session

Steps:

1. Analyze conversation for reusable patterns
2. Identify behaviors that could be generalized
3. Generate pattern documents with confidence scores
4. Optionally save to learning system

Pattern Categories:

| Category | Description |
|----------|-------------|
| code | Code patterns, idioms, best practices |
| workflow | Process patterns, decision trees |
| debugging | Debug approaches, root cause analysis |
| architecture | Design patterns, structural decisions |

Output:
## Session Learning Report

**Session Duration:** 45 minutes
**Patterns Extracted:** 3

### Pattern 1: Error Boundary Pattern
- **Category:** code
- **Context:** React components with async data
- **Behavior:** Wrap async operations in try-catch with fallback UI
- **Confidence:** 0.85
- **Evidence:** Used successfully in 3 components

### Pattern 2: Incremental Migration Strategy
- **Category:** workflow
- **Context:** Large refactoring tasks
- **Behavior:** Migrate file-by-file with tests at each step
- **Confidence:** 0.90
- **Evidence:** Applied to 5-file migration without breaking

### Pattern 3: Root Cause Debugging
- **Category:** debugging
- **Context:** Intermittent test failures
- **Behavior:** Isolate flaky tests, add logging, run in isolation
- **Confidence:** 0.75
- **Evidence:** Resolved 2 flaky tests

**Action:** Patterns saved to state/learning/2026-03-01-session-patterns.md
```

---

## P2: Language-Specific Rules

### Why
Allows agents to load appropriate rules based on task context.

### Directory Structure

```
.claude/rules/
├── common/
│   ├── security.md
│   ├── git.md
│   └── testing.md
├── typescript/
│   ├── naming.md
│   ├── patterns.md
│   └── react.md
├── python/
│   ├── naming.md
│   ├── patterns.md
│   └── django.md
└── golang/
    ├── naming.md
    ├── patterns.md
    └── concurrency.md
```

### Example: TypeScript Rules

**`.claude/rules/typescript/patterns.md`**

```markdown
# TypeScript Patterns

## Error Handling
- Use Result<T, E> pattern for expected errors
- Throw exceptions only for unexpected errors
- Always handle Promise rejection

## Type Safety
- Prefer type over interface for unions
- Use const assertions for literal types
- Avoid any; use unknown with type guards

## React Components
- Use function components with hooks
- Props interface named ComponentNameProps
- Event handlers prefixed with handle

## Testing
- Co-locate tests with source files
- Use describe/it pattern
- Mock external dependencies
```

### Usage in Skills

```markdown
<!-- In a skill -->
## Rules to Load
Load language-specific rules based on project context:
- TypeScript: .claude/rules/typescript/*.md
- Python: .claude/rules/python/*.md
- Go: .claude/rules/golang/*.md
```

---

## Implementation Checklist

### P1 - Do First
- [ ] Create `.claude/skills/strategic-compact/SKILL.md`
- [ ] Create `config/mcp/` directory
- [ ] Add `config/mcp/github.json`
- [ ] Add `config/mcp/supabase.json`
- [ ] Test MCP configurations with agents

### P2 - Do Next
- [ ] Create `.claude/commands/verify.md`
- [ ] Create `.claude/commands/learn.md`
- [ ] Create `.claude/rules/` directory structure
- [ ] Add common rules
- [ ] Add TypeScript rules
- [ ] Add Python rules

### P3 - Nice to Have
- [ ] Add hook system
- [ ] Add more commands from ECC
- [ ] Add Go rules
- [ ] Add more MCP configurations

---

## Testing

After implementing each component:

```bash
# Test strategic-compact
npx tsx lib/orchestrator.ts
# Submit a task, wait for completion
# Verify compact is suggested at safe points

# Test MCP configs
claude
> Use the github MCP to search for repositories

# Test verify command
/verify --type all

# Test learn command
/learn --save

# Test rules
# Start a TypeScript task, verify rules are applied
```
