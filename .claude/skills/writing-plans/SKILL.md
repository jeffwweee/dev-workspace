---
name: writing-plans
description: Use when you have a spec or requirements for a multi-step task, before touching code
---

# Writing Plans

## Overview

Write comprehensive implementation plans assuming the engineer has zero context for our codebase and questionable taste. Document everything they need to know: which files to touch for each task, code, testing, docs they might need to check, how to test it. Give them the whole plan as bite-sized tasks. DRY. YAGNI. TDD. Frequent commits.

Assume they are a skilled developer, but know almost nothing about our toolset or problem domain. Assume they don't know good test design very well.

**Announce at start:** "I'm using the writing-plans skill to create the implementation plan."

**Context:** This should be run in a dedicated worktree (created by `node bin/dw.js claim --task TASK-XXX`).

**Save plans to:** `docs/plans/YYYY-MM-DD-<feature-name>.md`

## Usage Modes

### Mode 1: From Task Registry (Recommended)

Read task from tasks.json and create implementation plan:

```bash
/writing-plans --task TASK-001
```

**Process:**
1. Read task from `tasks.json` (or project's tasks file)
2. Parse task description, requirements, acceptance criteria
3. Explore codebase to understand context
4. Create detailed implementation plan
5. Link plan back to task in registry

### Mode 2: From Design Document

After brainstorming skill creates a design doc:

```bash
/writing-plans --design docs/plans/2026-02-24-feature-design.md
```

**Process:**
1. Read design document
2. Extract requirements and architecture decisions
3. Create detailed implementation plan

### Mode 3: From Scratch

Create plan directly from user requirements:

```bash
/writing-plans "Add retry mechanism to API client"
```

**Process:**
1. Gather requirements through questions
2. Explore codebase
3. Create implementation plan

## Bite-Sized Task Granularity

**Each step is one action (2-5 minutes):**
- "Write the failing test" - step
- "Run it to make sure it fails" - step
- "Implement the minimal code to make the test pass" - step
- "Run the tests and make sure they pass" - step
- "Commit" - step

## Plan Document Header

**Every plan MUST start with this header:**

```markdown
# [Feature Name] Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `executing-plans` or `subagent-driven-development` skill to implement this plan task-by-task.

**Goal:** [One sentence describing what this builds]

**Architecture:** [2-3 sentences about approach]

**Tech Stack:** [Key technologies/libraries]

---
```

## Task Structure

````markdown
### Task N: [Component Name]

**Files:**
- Create: `exact/path/to/file.py`
- Modify: `exact/path/to/existing.py:123-145`
- Test: `tests/exact/path/to/test.py`

**Step 1: Write the failing test**

```python
def test_specific_behavior():
    result = function(input)
    assert result == expected
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/path/test.py::test_name -v`
Expected: FAIL with "function not defined"

**Step 3: Write minimal implementation**

```python
def function(input):
    return expected
```

**Step 4: Run test to verify it passes**

Run: `pytest tests/path/test.py::test_name -v`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/path/test.py src/path/file.py
git commit -m "feat: add specific feature"
```
````

## Remember
- Exact file paths always
- Complete code in plan (not "add validation")
- Exact commands with expected output
- Reference relevant skills with @ syntax
- DRY, YAGNI, TDD, frequent commits

## Execution Handoff

After saving the plan, offer execution choice:

**"Plan complete and saved to `docs/plans/<filename>.md`. Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?"**

**If Subagent-Driven chosen:**
- **REQUIRED SUB-SKILL:** Use `subagent-driven-development` skill
- Stay in this session
- Fresh subagent per task + code review

**If Parallel Session chosen:**
- Guide them to open new session in worktree
- **REQUIRED SUB-SKILL:** New session uses `executing-plans` skill

## Integration with project-planner

### Recommended Workflow

```
# Step 1: Register the task
/project-planner --plan "Add retry mechanism to API client"
# Output: Created TASK-015

# Step 2: Claim the task (creates worktree)
node bin/dw.js claim --task TASK-015

# Step 3: Create implementation plan
/writing-plans --task TASK-015
# Reads task from tasks.json
# Creates docs/plans/2026-02-24-retry-implementation.md

# Step 4: Execute the plan
/executing-plans --plan docs/plans/2026-02-24-retry-implementation.md
# OR
/subagent-driven-development --plan docs/plans/2026-02-24-retry-implementation.md

# Step 5: Update task status when complete
/project-planner --update-task TASK-015 --status completed --passes true
```

### Task Registry Fields Used

When reading from tasks.json, extract:

| Field | Usage |
|-------|-------|
| `id` | Task ID for plan header |
| `description` | Main requirement text |
| `acceptanceCriteria` | Success conditions |
| `priority` | Plan complexity guidance |
| `dependencies` | Prerequisite tasks to check |
| `labels` | Category for tech stack hints |

### Plan Header with Task Link

When using `--task`, include task reference in header:

```markdown
# [Feature Name] Implementation Plan

> **Task:** TASK-015
> **For Claude:** REQUIRED SUB-SKILL: Use `executing-plans` or `subagent-driven-development` skill to implement this plan task-by-task.

**Goal:** [One sentence describing what this builds]

**Architecture:** [2-3 sentences about approach]

**Tech Stack:** [Key technologies/libraries]

---
```
