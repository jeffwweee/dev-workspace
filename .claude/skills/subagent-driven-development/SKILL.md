---
name: subagent-driven-development
description: Use when executing implementation plans with independent tasks in the current session
---

# Subagent-Driven Development

Execute plan by dispatching fresh subagent per task, with two-stage review after each: spec compliance review first, then code quality review.

**Core principle:** Fresh subagent per task + two-stage review (spec then quality) = high quality, fast iteration

## Usage

```bash
# Execute specific plan file
/subagent-driven-development --plan docs/plans/2026-02-24-feature.md

# Execute plan linked to task (reads plan path from task)
/subagent-driven-development --task TASK-001
```

## When to Use

**Use this skill when:**
- You have an implementation plan
- Tasks are mostly independent
- You want to stay in the current session
- You want fast iteration without human-in-loop between tasks

**Use `executing-plans` instead when:**
- You want batch execution with human review checkpoints
- You're running in a parallel/separate session

## Context: Dev-Workspace Integration

This skill works within dev-workspace session management:

**Before starting:**
```bash
# Ensure you have an active session
node bin/dw.js status

# Claim the task (creates worktree)
node bin/dw.js claim --task TASK-XXX
```

**Working directory:** Tasks execute in worktrees at `~/worktrees/<project>/<task>/`

## Evolution Integration

During subagent execution, emit signals for evolution tracking:

### Per-Task Signals

When a task completes successfully:
```bash
node -e "require('./lib/evolution-session.cjs').emitSignal(process.env.CLAUDE_SESSION_ID || 'local', 'completion', {task: '<task-id>', approach: '<approach-name>', duration: <seconds>}).then(() => process.exit(0))" 2>/dev/null || true
```

When an error is recovered:
```bash
node -e "require('./lib/evolution-session.cjs').emitSignal(process.env.CLAUDE_SESSION_ID || 'local', 'repair', {error: '<error>', fix: '<fix>', success: true}).then(() => process.exit(0))" 2>/dev/null || true
```

When stuck detection triggers:
```bash
node -e "require('./lib/evolution-session.cjs').emitSignal(process.env.CLAUDE_SESSION_ID || 'local', 'stuck', {type: '<stuck-type>', loopCount: <count>}).then(() => process.exit(0))" 2>/dev/null || true
```

## The Process

### Setup

1. Read plan file from `docs/plans/YYYY-MM-DD-<feature-name>.md`
2. Extract all tasks with full text and context
3. Note the overall context (what feature, how tasks relate)
4. Create TodoWrite/TaskCreate with all tasks

### Per-Task Loop

For each task:

#### 1. Dispatch Implementer Subagent

Send to Task tool with:
- Full task text (not "read the plan")
- Context about where this fits
- Files involved
- Success criteria

**If implementer asks questions:**
- Answer clearly and completely
- Provide additional context if needed
- Don't rush them into implementation

**Implementer completes:**
- Implements the code
- Runs tests
- Commits
- Self-reviews

#### 2. Spec Compliance Review

Dispatch spec reviewer subagent to verify:
- All requirements from task are implemented
- Nothing extra was added (YAGNI)
- Behavior matches spec

**If issues found:**
- Implementer fixes them
- Re-review until spec compliant

#### 3. Code Quality Review

Dispatch code quality reviewer subagent to check:
- Code cleanliness
- Proper patterns
- No obvious issues

**If issues found:**
- Implementer fixes them
- Re-review until approved

#### 4. Mark Task Complete

Update TodoWrite/TaskUpdate to mark completed.

### After All Tasks

1. **Final review** - Dispatch code reviewer for entire implementation
2. **Verify** using `verification-before-completion` skill
3. **Update docs** via `docs-creator` skill
4. **Finish branch** using `finishing-a-development-branch` skill

## Example Workflow

```
You: I'm using Subagent-Driven Development to execute this plan.

[Read plan: docs/plans/feature-plan.md]
[Extract 5 tasks with full text and context]
[Create TaskList with all tasks]

Task 1: Hook installation script

[Get Task 1 text and context]
[Dispatch implementation subagent]

Implementer: "Before I begin - should the hook be installed at user or system level?"

You: "User level (~/.config/hooks/)"

Implementer: "Got it. Implementing now..."
[Later] Implementer:
  - Implemented install-hook command
  - Added tests, 5/5 passing
  - Self-review: Found I missed --force flag, added it
  - Committed

[Dispatch spec compliance reviewer]
Spec reviewer: Spec compliant - all requirements met, nothing extra

[Dispatch code quality reviewer]
Code reviewer: Strengths: Good test coverage, clean. Issues: None. Approved.

[Mark Task 1 complete]

Task 2: ...

[After all tasks]
[Dispatch final code-reviewer]
Final reviewer: All requirements met, ready to merge

[verification-before-completion]
[docs-creator]
[finishing-a-development-branch]
```

## Advantages

**vs. Manual execution:**
- Subagents follow TDD naturally
- Fresh context per task (no confusion)
- Can ask questions before and during work

**vs. Executing Plans (batch):**
- Same session (no handoff)
- Continuous progress (no waiting between tasks)
- Automatic review checkpoints

## Red Flags

**Never:**
- Start implementation on main/master branch without explicit user consent
- Skip reviews (spec compliance OR code quality)
- Proceed with unfixed issues
- Dispatch multiple implementation subagents in parallel (conflicts)
- Make subagent read plan file (provide full text instead)
- Skip scene-setting context (subagent needs to understand where task fits)
- Ignore subagent questions (answer before letting them proceed)
- Accept "close enough" on spec compliance
- Skip review loops (reviewer found issues = implementer fixes = review again)
- **Start code quality review before spec compliance is approved** (wrong order)
- Move to next task while either review has open issues

**If subagent asks questions:**
- Answer clearly and completely
- Provide additional context if needed
- Don't rush them into implementation

**If reviewer finds issues:**
- Implementer (same subagent) fixes them
- Reviewer reviews again
- Repeat until approved
- Don't skip the re-review

## Dev-Workspace Session Flow

```
node bin/dw.js claim --task TASK-XXX
    ↓
Worktree created at ~/worktrees/<project>/TASK-XXX
    ↓
Load plan from docs/plans/
    ↓
For each task:
    ├── Dispatch implementer subagent
    ├── Spec compliance review
    ├── Code quality review
    └── Mark complete
    ↓
verification-before-completion
    ↓
docs-creator (update progress.md)
    ↓
finishing-a-development-branch
    ↓
node bin/dw.js release --all
```

## Integration

**Required workflow skills:**
- **writing-plans** - Creates the plan this skill executes
- **code-reviewer** - Can be used for spec/quality reviews
- **finishing-a-development-branch** - Complete development after all tasks
- **verification-before-completion** - Verify before claiming done

**Subagents should use:**
- **test-driven-development** - Follow TDD for each task

**Orchestration:**
- **project-session** - Can delegate to this skill for plan execution
