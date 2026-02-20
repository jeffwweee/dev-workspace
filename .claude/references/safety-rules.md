# Safety Rules

## Overview

Safety rules use the NEVER/ALWAYS pattern to establish clear, actionable boundaries for skill behavior. Each skill defines its own specific rules following these patterns.

## Rule Categories

### Read-Only Operations

For skills that should NOT modify files (code-reviewer, tester):

```
1. **NEVER modify files** - Read-only operations only
2. **ALWAYS report all findings** - Don't hide issues
3. **NEVER skip checks** - Without documentation
4. **ALWAYS provide specific locations** - Line numbers, file paths
```

### Write Operations

For skills that modify files (git-agent, docs-creator, project-planner):

```
1. **ALWAYS verify before modifying** - Check preconditions
2. **NEVER destroy data** - Without backup/confirmation
3. **ALWAYS preserve existing content** - Append, don't replace
4. **NEVER commit sensitive data** - No keys, passwords, tokens
```

### Destructive Operations

For skills with destructive potential (git-agent):

```
1. **NEVER force push** - Without explicit user request
2. **ALWAYS create backups** - Before major changes
3. **NEVER auto-resolve conflicts** - Require user decision
4. **ALWAYS check git status** - Before destructive operations
```

### Coordination Operations

For skills that coordinate work (project-session, project-planner):

```
1. **ALWAYS claim locks first** - Before any work
2. **NEVER bypass safety gates** - Follow Start, Completion, End gates
3. **ALWAYS verify before completion** - Tests must pass
4. **NEVER delete tasks** - Mark as cancelled instead
```

## Rule Format

Each rule should be:
- **Actionable** - Clear yes/no decision
- **Specific** - Exact behavior expected
- **Justified** - Reason is self-evident

### Pattern: NEVER Rules

```
**NEVER <action>** - <reason/consequence>
```

Examples:
- `**NEVER delete tasks** - Mark as cancelled instead`
- `**NEVER commit sensitive data** - No keys, passwords, tokens`
- `**NEVER bypass safety gates** - Follow Start, Completion, End gates`

### Pattern: ALWAYS Rules

```
**ALWAYS <action>** - <reason/consequence>
```

Examples:
- `**ALWAYS claim locks first** - Before any work`
- `**ALWAYS update updatedAt** - Set timestamp on every modification`
- `**ALWAYS verify commits** - Before pushing`

## Adding Rules to Skills

When adding safety rules to a skill:

1. Choose the appropriate category
2. Adapt rules to skill-specific context
3. Add skill-specific rules as needed
4. Keep to 4-6 rules maximum
5. Order by importance (most critical first)

## Common Rule Templates

### File Operations
```
1. **NEVER delete existing entries** - Only append new ones
2. **ALWAYS use ISO timestamps** - Format: YYYY-MM-DD HH:MM UTC
3. **ALWAYS preserve formatting** - Maintain existing structure
4. **NEVER modify historical entries** - Preserve audit trail
```

### Testing Operations
```
1. **NEVER modify code** - During testing
2. **ALWAYS report all failures** - Don't hide issues
3. **NEVER skip tests** - Without documentation
4. **ALWAYS include test output** - In evidence section
```

### Git Operations
```
1. **ALWAYS check git status** - Before destructive operations
2. **NEVER force push** - Without explicit user request
3. **ALWAYS create backup branches** - Before major changes
4. **NEVER commit sensitive data** - No keys, passwords, tokens
```
