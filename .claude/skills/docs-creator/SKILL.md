---
name: docs-creator
description: "Documentation creation and updates for dev-workspace projects. Creates and maintains progress.md session logs, PROJECT_CONTEXT.md project overview, and other project documentation. Use for creating initial project documentation, updating progress after work completion, adding project context, documenting decisions or architecture."
---

# Docs Creator

## Overview

Creates and updates documentation files including progress.md, PROJECT_CONTEXT.md, and other project documentation.

## Commands

### Create Project Context

Create PROJECT_CONTEXT.md with project overview, architecture, and setup instructions:

```bash
/docs-creator --create-context
```

### Update Progress

Update progress.md with latest session work, decisions, and outcomes:

```bash
/docs-creator --update-progress --task TASK-001 --summary "Implemented feature X"
```

### Document Decision

Record an architectural or technical decision:

```bash
/docs-creator --document-decision "Use OAuth2 for authentication" --reason "Security requirements"
```

### Create README

Create or update README.md with project information:

```bash
/docs-creator --create-readme
```

## progress.md Template

```markdown
# Project Progress

## Overview
<Brief project description>

## Session Log

### 2024-01-15 10:30 UTC
**Session:** sess-abc123
**Task:** TASK-001 - Implement feature X

**Work Done:**
- Created src/feature.ts
- Added tests for feature
- Updated documentation

**Outcome:** Complete - tests passing

**Files Changed:**
- src/feature.ts (new)
- tests/feature.test.ts (new)
- README.md (updated)

### <older entries>

## Current Status
- Active Task: TASK-002
- Blockers: None
- Next Steps: Implement feature Y
```

## PROJECT_CONTEXT.md Template

```markdown
# Project Context

## Overview
<What this project does>

## Architecture
<Technical architecture, key components>

## Setup
```bash
npm install
npm run dev
```

## Project Structure
```
src/
├── components/
├── utils/
└── index.ts
```

## Conventions
- Code style: <eslint/prettier config>
- Commit format: <conventional commits, etc.>
- Branch naming: <feature/bugfix prefix>
```

## Return Contract

See [return-contract.md](../references/return-contract.md).

## Safety Rules

1. **NEVER delete existing log entries** - Only append new ones
2. **ALWAYS use ISO timestamps** - See [conventions.md](../references/conventions.md#timestamp-format)
3. **ALWAYS include session ID** - For traceability
4. **NEVER modify historical entries** - Preserve audit trail
5. **ALWAYS preserve formatting** - Maintain markdown structure

See [safety-rules.md](../references/safety-rules.md#file-operations) for patterns.

## Error Handling

- **If file doesn't exist**: Create with appropriate template, notify user
- **If file is corrupt**: Backup existing file to `.bak`, create fresh file from template, notify user

See [error-handling.md](../references/error-handling.md) for patterns.

## Example

```
User: /docs-creator --update-progress --task TASK-001 --summary "Implemented user login"

Status: SUCCESS

Summary:
- Updated progress.md with session log
- Documented TASK-001 completion
- Added timestamp and outcomes

Files changed:
- progress.md

Commands run:
- None (direct file edit)

Evidence:
- Added entry: 2024-01-15 10:30 UTC - TASK-001 completed
- Updated current status section

Next recommended:
- node bin/dw.js record-result --task TASK-001 --status passed
```
