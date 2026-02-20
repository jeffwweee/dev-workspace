# Error Handling

## Overview

Standard error handling patterns for dev-workspace skills. Follow these patterns for consistent, helpful error messages.

## Pattern: File Not Found

When a required file doesn't exist:

```markdown
If file doesn't exist:
- Create with appropriate template
- Notify user of new file creation
```

## Pattern: File Corrupted

When a file is malformed:

```markdown
If file is corrupt:
- Backup existing file to `.bak`
- Create fresh file from template
- Notify user of backup location
```

## Pattern: Missing Tool/Config

When a required tool is not configured:

```markdown
If <tool> not configured:
- Report missing tool
- Suggest installation command
- Offer manual alternative
```

## Pattern: Syntax Errors

When code has syntax errors:

```markdown
If syntax errors found:
- Report as critical issue
- Do not proceed with review
- Suggest fixing syntax first
```

## Pattern: Test Failures

When tests fail:

```markdown
If tests fail:
- Report all failing tests
- Include error messages
- Suggest fixes
- Do NOT mark task as passed
```

## Pattern: Merge Conflicts

When git conflicts occur:

```markdown
If merge conflicts:
- Report conflicting files
- Provide conflict resolution steps
- Do not auto-resolve
```

## Pattern: Lock Contention

When resource is locked:

```markdown
If resource locked:
- Report lock owner
- Show lock TTL
- Suggest waiting or contacting owner
```

## Pattern: Invalid Task

When task ID is invalid:

```markdown
If task ID not found:
- Report error with missing task ID
- Suggest valid task IDs
- Do not proceed without valid task
```

## Pattern: Circular Dependencies

When circular dependencies detected:

```markdown
If circular dependency detected:
- Report the cycle (A -> B -> C -> A)
- Do not apply changes
- Suggest breaking the cycle
```

## Error Response Format

All errors should be reported in the return contract:

```
Status: FAILURE

Summary:
- <what was attempted>
- <what went wrong>

Files changed:
- None (error before changes)

Commands run:
- <commands that failed>

Evidence:
- <error message>
- <suggested fix>

Next recommended:
- <action to resolve>
```

## Graceful Degradation

When full functionality isn't available:

1. **Detect** - Check for required tools/files
2. **Fallback** - Offer alternative approach
3. **Notify** - Inform user of limitation
4. **Proceed** - Continue with reduced functionality

Example:
```markdown
If linter not configured:
- Report missing tool
- Suggest installation: `npm install -D eslint`
- Offer manual review alternative
- Proceed with manual review
```
