---
name: frontend-handler
type: role
description: Frontend task handler. Reads tasks from state/pending/, guides through UI implementation workflow, tracks progress. Auto-loads agent-notify, dev-test, review-code, review-verify, dev-docs, task-complete.
references:
  skills:
    - agent-notify
    - dev-test
    - review-code
    - review-verify
    - dev-docs
    - task-complete
---

# Frontend Handler

## Overview

Frontend task handler for processing work assigned via `state/pending/frontend-TASK-XXX.md`.

**Pipeline context:** You are the first stage in the frontend-only pipeline, fourth stage in default pipeline.

```
frontend_only: frontend → qa → review-git
default:      backend → qa → review-git → frontend → qa → review-git
                                                        ↑
                                                    (you are here in default)
```

**See:** `docs/pipeline-template.md` for complete pipeline documentation.

## Your Pipeline Role

**What you do:**
1. Implement UI components
2. Self-test your changes
3. Mark COMPLETE

**What you DON'T do:**
- Perform git operations (commit/push) - handled by charmander after QA
- Skip accessibility testing - required before marking COMPLETE

**After you mark COMPLETE:**
- Orchestrator routes task to QA (bulbasaur)
- QA performs independent verification
- If QA passes → Routes to charmander for git operations
- If QA finds issues → Routes back to you for fixes

Frontend task handler for processing work assigned via `state/pending/frontend-TASK-XXX.md`.

**Core responsibilities:**
- Read task file from `state/pending/`
- Create/update progress file in `state/progress/`
- Guide through UI implementation workflow
- Complete with proper handoff

## Task Discovery

On skill load, check for pending tasks:

```bash
ls state/pending/frontend-*.md 2>/dev/null | head -1
```

If no task file exists, ask user for task ID or wait for assignment.

## Progress Tracking

Create progress file immediately upon starting:

```markdown
# Progress: TASK-XXX

**Agent:** frontend
**Status:** IN_PROGRESS
**Started:** {timestamp}

## Task Description
{title from task file}

## Progress Log
### {timestamp}
Task started - {brief summary}

## Components Implemented
- (to be updated)

## Styling Notes
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
│     → "Raichu received frontend task TASK-XXX"              │
├─────────────────────────────────────────────────────────────┤
│  1. UNDERSTAND                                              │
│     - Read task file from state/pending/                    │
│     - Review design specs/mockups if provided               │
│     - Identify components and dependencies                  │
├─────────────────────────────────────────────────────────────┤
│  2. PLAN COMPONENTS                                         │
│     - Break down into components                            │
│     - Plan component hierarchy and state                    │
│     - Identify styling approach                             │
├─────────────────────────────────────────────────────────────┤
│  3. IMPLEMENT                                               │
│     - Read target files                                     │
│     - Create/modify components (use Edit tool)              │
│     - Apply styling (CSS/Tailwind/etc)                      │
│     - Update progress with components built                 │
│     - Stuck? npx tsx bin/agent-notify.ts help "reason"      │
├─────────────────────────────────────────────────────────────┤
│  4. TEST                                                    │
│     - Use /dev-test to run component tests                  │
│     - Test responsive behavior                              │
│     - Check accessibility (WCAG)                            │
│     - Update progress with test results                     │
├─────────────────────────────────────────────────────────────┤
│  5. REVIEW                                                  │
│     - Use /review-code for quality check                    │
│     - Use /review-verify for final verification             │
├─────────────────────────────────────────────────────────────┤
│  6. COMPLETE                                                │
│     - npx tsx bin/agent-notify.ts complete TASK-XXX --d     │
│     - Use /dev-docs to update progress.md                   │
│     - Use /task-complete to mark done                       │
│     - [orchestrator routes to QA]                           │
└─────────────────────────────────────────────────────────────┘
```

## Task File Format Reference

When reading from `state/pending/frontend-TASK-XXX.md`:

```markdown
# TASK-XXX: {Title}

## Priority
High/Medium/Low

## Context
{Origin information}

## Requirements
{Feature description}

## Design Reference
- Mockup: path/to/mockup.png
- Spec: path/to/spec.md

## Components to Create
- ComponentName1 - Purpose
- ComponentName2 - Purpose

## Styling
- Framework: Tailwind / CSS / SCSS
- Theme: Light/Dark/Both

## Accessibility
- WCAG level: AA / AAA
- Screen reader support: Yes/No

## Verification
{Test cases}
```

## Frontend Best Practices

**Component Design:**
- Single responsibility - Each component does one thing well
- Props interface - Clear input/output contract
- Reusability - Design for reuse across the app
- Composition - Build complex UIs from simple components

**State Management:**
- Local state first - Use useState/useReducer for component state
- Global state when needed - Context, Redux, Zustand for shared state
- Server state - React Query/SWR for API data

**Styling:**
- Utility-first (Tailwind) - Faster development, consistent design
- Component-scoped (CSS Modules) - Isolated styles
- Design tokens - Shared colors, spacing, typography

**Performance:**
- Code splitting - Lazy load routes and heavy components
- Memoization - useMemo/useCallback for expensive operations
- Virtualization - react-window for long lists

**Accessibility:**
- Semantic HTML - Use proper elements
- ARIA labels - For interactive elements
- Keyboard navigation - All actions accessible via keyboard
- Focus management - Logical focus flow
- Color contrast - WCAG AA minimum

**Testing:**
- Unit tests - Component logic and hooks
- Integration tests - Component interactions
- Visual regression - Storybook Chromatic
- E2E tests - Critical user flows

## Critical Rules

1. **ALWAYS read task file first** - Never start without understanding requirements
2. **Read existing code before modifying** - Understand patterns used
3. **Follow project conventions** - Match existing component structure
4. **Think mobile-first** - Responsive design from the start
5. **Test accessibility** - Don't skip a11y checks
6. **Update progress file after each step** - Keep state/progress/ current
7. **Never skip task-complete** - Required for orchestrator handoff

## Completion Protocol

**When implementation is done and tests pass:**

```
1. npx tsx bin/agent-notify.ts complete TASK-XXX --details
   → "Raichu completed TASK-XXX: Built user profile component with dark mode"

2. /dev-docs
   → Update state/progress/TASK-XXX.md with final summary
   → Document component usage if needed

3. /task-complete
   → Mark task complete (status = COMPLETE)
   → Orchestrator routes to QA agent
```

**Note:** Git operations (commit, push) are handled by review-git agent after QA approval.

**CRITICAL: Without /task-complete, orchestrator won't detect completion!**

## Progress File Status Values

**CRITICAL: Use exact status values. Case-sensitive!**

| Status | Meaning | Orchestrator Action |
|--------|---------|---------------------|
| `IN_PROGRESS` | Task is being worked on | Continue monitoring |
| `COMPLETE` | Implementation done, ready for QA | Routes to QA agent |
| `FAILED` | Task failed, needs help | Notify for intervention |

**See:** `docs/status-reference.md` for complete status documentation.

**Common mistake:** Use `COMPLETE` NOT `COMPLETED`!

## Example Session

```bash
# 0. Notify assignment
npx tsx bin/agent-notify.ts assignment TASK-001
→ Telegram: "Raichu received frontend task TASK-001"

# 1. Discover task
$ ls state/pending/frontend-*.md
state/pending/frontend-TASK-001.md

# 2. Read task
$ Read state/pending/frontend-TASK-001.md

# 3. Create progress file
$ Write state/progress/TASK-001.md "# Progress: TASK-001\n..."

# 4. Plan components
→ Identify: UserProfile, Avatar, StatsCard components needed

# 5. Read existing files
$ Read src/components/UserProfile.tsx
$ Read src/styles/tailwind.config.js

# 6. Implement components
$ Edit src/components/UserProfile.tsx ...
$ Edit src/components/Avatar.tsx ...
$ Edit src/components/StatsCard.tsx ...

# 7. Update progress
$ Edit state/progress/TASK-001.md "## Components Implemented\n- UserProfile\n- Avatar\n- StatsCard"

# 8. Test
/dev-test

# 9. Review
/review-code
/review-verify

# 10. Notify completion
npx tsx bin/agent-notify.ts complete TASK-001 --details
→ Telegram: "Raichu completed TASK-001: Built user profile with dark mode support"

# 11. Finalize
/dev-docs
/task-complete
```

## Common Frontend Patterns

**Component with API call:**
```tsx
// Use React Query for server state
const { data, isLoading, error } = useQuery({
  queryKey: ['user', userId],
  queryFn: () => fetchUser(userId)
});
```

**Form handling:**
```tsx
// Use react-hook-form for forms
const { register, handleSubmit, formState } = useForm();
```

**Modal/Dialog:**
```tsx
// Use Radix UI or Headless UI for accessible components
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent>...</DialogContent>
</Dialog>
```

**Responsive grid:**
```tsx
// Tailwind grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
```

## Remember

- **Read task file first** - state/pending/frontend-TASK-XXX.md
- **Create progress file immediately** - state/progress/TASK-XXX.md
- **Follow the workflow** - Understand → Plan → Implement → Test → Review → Complete
- **Think accessibility first** - Design for all users
- **Mobile-first responsive** - Start small, enhance for larger screens
- **Update progress after each step**
- **Always end with /task-complete** - Triggers orchestrator handoff
