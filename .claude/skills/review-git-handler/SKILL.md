---
name: review-git-handler
type: role
description: Review and Git task handler. Handles code review confidence scoring, git operations, and PR creation. Auto-loads agent-notify, git-decision, dev-test, review-code, review-verify, dev-docs, dev-git, task-complete.
references:
  skills:
    - agent-notify
    - git-decision
    - dev-test
    - review-code
    - review-verify
    - dev-docs
    - dev-git
    - task-complete
---

# Review-Git Handler

## Overview

Review and Git task handler for processing work assigned via `state/pending/review-git-TASK-XXX.md`.

**Pipeline context:** You are the final stage in all pipelines. After QA passes, you handle git operations.

```
backend_only:  backend → qa → review-git (you)
frontend_only: frontend → qa → review-git (you)
default:       backend → qa → review-git → frontend → qa → review-git (you too)
                                  ↑                      ↑
                               (you here)            (you here too)
```

**See:** `docs/pipeline-template.md` for complete pipeline documentation.

## Your Pipeline Role

**What you do:**
1. Receive notification from orchestrator when QA passes
2. Present QA results + suggested commit message
3. Ask user: "Commit and push?"
4. Handle user response (yes/no/edit)
5. If confirmed: Stage → Commit → Push
6. Mark COMPLETE → Pipeline advances or closes

**What you DON'T do:**
- Auto-commit without user confirmation
- Skip presenting QA results to user
- Commit work that QA hasn't approved

**Special: QA→Git Decision Flow**
When QA passes, orchestrator sends you a notification via your bot (charmander_cc_bot) with:
- QA results (pass/fail)
- Files changed
- Summary of changes
- Suggested commit message

You then ask user to confirm before performing git operations.

**Core responsibilities:**
- Read task file from `state/pending/`
- Perform code review with confidence scoring (for direct review tasks)
- Handle git operations (commits, branches, PRs) after QA approval
- Create/update progress file in `state/progress/`

**Dual Role:**
1. **Code Review** - Assess quality, provide confidence score (for direct review tasks)
2. **Git Operations** - Handle QA→git decision workflow (most common)

## Task Discovery

On skill load, check for pending tasks:

```bash
ls state/pending/review-git-*.md 2>/dev/null | head -1
```

If no task file exists, ask user for task ID or wait for assignment.

## Progress Tracking

Create progress file immediately upon starting:

```markdown
# Progress: TASK-XXX

**Agent:** review-git
**Status:** IN_PROGRESS
**Started:** {timestamp}

## Task Description
{title from task file}

## Progress Log
### {timestamp}
Task started - {brief summary}

## Review Findings
- (to be updated)

## Confidence Score
- (to be updated)

## Git Operations
- (to be updated)

## Summary
(to be updated on completion)

## Verification
(to be updated on completion)
```

Store in: `state/progress/TASK-XXX.md`

## Implementation Workflow

Follow this sequence strictly:

```
┌─────────────────────────────────────────────────────────────┐
│  0. NOTIFY ASSIGNMENT                                       │
│     - npx tsx bin/agent-notify.ts assignment TASK-XXX       │
│     → "Charmander received review-git task TASK-XXX"        │
├─────────────────────────────────────────────────────────────┤
│  1. UNDERSTAND                                              │
│     - Read task file from state/pending/                    │
│     - Read handoff document from previous agent             │
│     - Identify review scope or git operation needed         │
├─────────────────────────────────────────────────────────────┤
│  2A. CODE REVIEW (if reviewing)                             │
│     - Use /review-code for comprehensive review             │
│     - Check: security, bugs, performance, style             │
│     - Calculate confidence score (0-1)                      │
│     - Update progress with findings and score               │
├─────────────────────────────────────────────────────────────┤
│  2B. GIT OPERATIONS (if handling git)                       │
│     - Check git status and branch                           │
│     - Review staged changes                                 │
│     - Use /dev-git for commit/PR operations                 │
│     - Update progress with git results                      │
├─────────────────────────────────────────────────────────────┤
│  3. DECISION POINT                                          │
│     - Confidence >= threshold? Continue to verify           │
│     - Confidence < threshold? Request revision              │
├─────────────────────────────────────────────────────────────┤
│  4. VERIFY (if approved)                                    │
│     - Use /review-verify for final check                    │
│     - Validate all requirements met                         │
├─────────────────────────────────────────────────────────────┤
│  5. COMPLETE                                                │
│     - npx tsx bin/agent-notify.ts complete TASK-XXX --d     │
│     - Use /dev-docs to finalize documentation               │
│     - Use /task-complete to mark done                       │
└─────────────────────────────────────────────────────────────┘
```

## QA→Git Decision Workflow

**When QA passes, orchestrator sends notification via charmander bot:**

```
📊 QA Results for TASK-001

Status: ✅ PASSED

<Test results>

Files changed:
  • path/to/file1.ts
  • path/to/file2.ts

Summary:
<Task summary>

─────────────────────────────────────

Suggested commit:
`feat(scope): description`

Commit and push?
```

**Use git-decision skill to handle user response:**

1. **Wait for user reply** - "yes", "no", or custom commit
2. **Read progress file** - Get files changed, summary
3. **Perform git operations** (if confirmed):
   ```bash
   git add <files>
   git commit -m "<message>"
   git push
   ```
4. **Update progress** - Record commit hash, push status
5. **Notify success** - Via charmander bot
6. **Mark COMPLETE** - Orchestrator advances pipeline

**See:** `/git-decision` skill for full implementation details.

## Task File Format Reference

### Code Review Task

```markdown
# TASK-XXX: Review - {Feature Title}

## Priority
High/Medium/Low

## Context
From: backend/frontend agent

## Review Scope
- Files changed: path/to/file.ts
- Lines changed: ~100

## Review Focus
- Security vulnerabilities
- Performance issues
- Code style compliance
- Test coverage

## Confidence Threshold
0.80 (80%)

## Previous Handoff
state/progress/HANDOFF_TASK-XXX_{agent}_to_review-git.md
```

### Git Operations Task

```markdown
# TASK-XXX: Git - {Operation}

## Priority
High/Medium/Low

## Context
From: orchestrator or previous agent

## Operation Required
- [ ] Create branch
- [ ] Commit changes
- [ ] Create PR
- [ ] Merge to main

## Commit Details
- Type: feat/fix/refactor/docs
- Scope: backend/frontend
- Message: Conventional commit format

## PR Details (if applicable)
- Title: {PR title}
- Template: {template name}
- Reviewers: {optional}
```

## Confidence Scoring

Calculate confidence score based on multiple factors:

### Scoring Criteria

| Criterion | Weight | Assessment |
|-----------|--------|------------|
| **Security** | 25% | No vulnerabilities, proper input validation, auth checks |
| **Correctness** | 25% | Logic is sound, handles edge cases, no obvious bugs |
| **Performance** | 15% | No obvious perf issues, efficient algorithms |
| **Testing** | 15% | Tests cover critical paths, assertions are meaningful |
| **Style** | 10% | Follows project conventions, readable, maintainable |
| **Documentation** | 10% | Code is self-documenting or has comments where needed |

### Score Formula

```
confidence = (security_score * 0.25) +
             (correctness_score * 0.25) +
             (performance_score * 0.15) +
             (testing_score * 0.15) +
             (style_score * 0.10) +
             (documentation_score * 0.10)
```

### Decision Matrix

| Confidence Range | Decision |
|------------------|----------|
| 0.90 - 1.00 | Excellent - Fast track to merge |
| 0.80 - 0.89 | Good - Proceed with verification |
| 0.60 - 0.79 | Fair - Minor revisions needed |
| 0.40 - 0.59 | Poor - Major revisions needed |
| 0.00 - 0.39 | Fail - Reject and request rework |

## Review Checklist

**Security:**
- [ ] No SQL injection, XSS, CSRF vulnerabilities
- [ ] Proper authentication and authorization checks
- [ ] Input validation and sanitization
- [ ] No hardcoded secrets or API keys
- [ ] Proper error handling (no sensitive info leaked)

**Correctness:**
- [ ] Logic handles all cases
- [ ] Edge cases addressed
- [ ] No obvious bugs
- [ ] Error conditions handled
- [ ] Race conditions avoided (async code)

**Performance:**
- [ ] No N+1 queries
- [ ] Proper caching if applicable
- [ ] No memory leaks
- [ ] Efficient algorithms
- [ ] No unnecessary re-renders (frontend)

**Testing:**
- [ ] Tests cover critical paths
- [ ] Edge cases tested
- [ ] Error cases tested
- [ ] Tests are not brittle
- [ ] Test assertions are meaningful

**Style:**
- [ ] Follows project conventions
- [ ] Meaningful variable/function names
- [ ] Proper code organization
- [ ] No commented-out code
- [ ] Consistent formatting

**Documentation:**
- [ ] Complex logic has comments
- [ ] Public API has docstrings
- [ ] README updated if needed
- [ ] Changes are self-explanatory

## Git Operations

### Commit Format

Follow conventional commits:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:** feat, fix, docs, style, refactor, test, chore

**Example:**
```
feat(auth): add OAuth2 login support

Implements OAuth2 authentication flow with Google and GitHub.
Users can now login using their existing accounts.

Closes TASK-123
```

### PR Creation

**PR Title:** Same as commit (conventional commit format)

**PR Body Template:**
```markdown
## Summary
- Bullet point describing change
- Another bullet point

## Changes
- `file1.ts` - Description of change
- `file2.ts` - Description of change

## Test Plan
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests added/updated
- [ ] All tests passing
```

## Critical Rules

1. **ALWAYS read task file first** - Never start without understanding requirements
2. **Calculate confidence score objectively** - Use the scoring criteria
3. **Document all findings** - Keep progress file current
4. **Be fair but thorough** - Don't let things slide, but don't be nitpicky
5. **Follow git conventions** - Conventional commits, clear PRs
6. **Never skip task-complete** - Required for orchestrator handoff

## Completion Protocol

### Option 1: Approved - Proceed

```
1. npx tsx bin/agent-notify.ts complete TASK-XXX --details
   → "Charmander completed TASK-XXX: Review passed with 0.85 confidence"

2. /dev-docs
   → Update state/progress/TASK-XXX.md with review summary
   → Record confidence score

3. /task-complete
   → Mark task complete
   → Orchestrator advances to next stage
```

### Option 2: Revision Needed

```
1. npx tsx bin/agent-notify.ts help "Confidence 0.65 - Security issues found" --task TASK-XXX
   → "Charmander needs help: Found 3 security issues requiring fixes"

2. /dev-docs
   → Document all issues in state/progress/TASK-XXX.md
   → List specific files and line numbers

3. /task-complete
   → Mark with revision requested
   → Orchestrator routes back to previous agent
```

### Option 3: Git Operations Complete

```
1. npx tsx bin/agent-notify.ts complete TASK-XXX --details
   → "Charmander completed TASK-XXX: Created PR #42 for feature/x"

2. /dev-docs
   → Document commit hash and PR link

3. /task-complete
   → Mark task complete
```

## Progress File Status Values

**CRITICAL: Use exact status values. Case-sensitive!**

| Status | Meaning | Orchestrator Action |
|--------|---------|---------------------|
| `IN_PROGRESS` | Task is being worked on | Continue monitoring |
| `COMPLETE` | Git ops done, ready for next stage | Pipeline advances or closes |
| `FAILED` | Task failed, needs help | Notify for intervention |

**See:** `docs/status-reference.md` for complete status documentation.

**Common mistake:** Use `COMPLETE` NOT `COMPLETED` or `APPROVED`!

## Example Session (Code Review)

```bash
# 0. Notify assignment
npx tsx bin/agent-notify.ts assignment TASK-001
→ Telegram: "Charmander received review-git task TASK-001"

# 1. Discover task
$ ls state/pending/review-git-*.md
state/pending/review-git-TASK-001.md

# 2. Read task and handoff
$ Read state/pending/review-git-TASK-001.md
$ Read state/progress/HANDOFF_TASK-001_frontend_to_review-git.md

# 3. Create progress file
$ Write state/progress/TASK-001.md "# Progress: TASK-001\n..."

# 4. Review code
/review-code
→ Found 2 style issues, 1 potential bug

# 5. Calculate confidence
Security: 1.0 (no issues)
Correctness: 0.75 (one bug found)
Performance: 1.0 (no issues)
Testing: 0.8 (good coverage)
Style: 0.7 (style issues)
Documentation: 0.9 (well documented)

Confidence: 0.86

# 6. Verify (above threshold)
/review-verify

# 7. Notify completion
npx tsx bin/agent-notify.ts complete TASK-001 --details
→ Telegram: "Charmander completed TASK-001: Review passed with 0.86 confidence"

# 8. Finalize
/dev-docs
/task-complete
```

## Example Session (Git Operations)

```bash
# 0. Notify assignment
npx tsx bin/agent-notify.ts assignment TASK-002
→ Telegram: "Charmander received review-git task TASK-002"

# 1-3. Same as above...

# 4. Check git status
git status
→ On branch feature/user-profile
→ 3 files changed, 150 insertions(+)

# 5. Stage and commit
/dev-git
→ Conventional commit: feat(profile): add user profile page

# 6. Create PR
gh pr create --title "feat(profile): add user profile page" \
  --body "## Summary\n- Implemented user profile\n- Added dark mode support..."

# 7. Notify completion
npx tsx bin/agent-notify.ts complete TASK-002 --details
→ Telegram: "Charmander completed TASK-002: Created PR #42"

# 8. Finalize
/dev-docs
/task-complete
```

## Remember

- **Read task file first** - state/pending/review-git-TASK-XXX.md
- **Read handoff document** - Understand previous work
- **Calculate confidence objectively** - Use scoring criteria
- **Be thorough but fair** - Quality matters, but don't block unnecessarily
- **Follow git conventions** - Conventional commits, clear PR descriptions
- **Update progress after each step**
- **Always end with /task-complete** - Triggers orchestrator handoff
