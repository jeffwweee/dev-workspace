---
name: code-reviewer
description: "Code review and quality assessment for dev-workspace projects. Performs code review, lint checks, and quality assessments on changed files. Use for reviewing code changes before commit, running lint checks, assessing code quality, checking for security issues, and comparing branches or PRs."
---

# Code Reviewer

## Overview

Performs code review, lint checks, and quality assessments on changed files.

## Commands

### Review Files

Review specified files for code quality, best practices, and potential issues:

```bash
/skill code-reviewer --review src/auth.ts,src/utils.ts
```

### Run Linter

Run configured linter and report issues:

```bash
/skill code-reviewer --lint
```

### Security Scan

Check for security vulnerabilities in code:

```bash
/skill code-reviewer --security-scan
```

### Compare Branches

Compare current branch with specified branch:

```bash
/skill code-reviewer --compare main
```

### Review Checklist

Run through standard review checklist:

```bash
/skill code-reviewer --checklist
```

## Review Checklist

### Code Quality
- [ ] Code follows project style guide
- [ ] No unused variables or imports
- [ ] Error handling is appropriate
- [ ] Functions are appropriately sized
- [ ] Naming is clear and consistent

### Security
- [ ] No hardcoded secrets
- [ ] Input validation present
- [ ] Output encoding/sanitization
- [ ] Authentication/authorization checks

### Testing
- [ ] Tests included for new code
- [ ] Edge cases covered
- [ ] Test assertions are meaningful

### Documentation
- [ ] Comments where needed
- [ ] Complex logic explained
- [ ] API documentation updated

## Issue Categories

| Severity | Description | Action Required |
|----------|-------------|-----------------|
| Critical | Security vulnerability, data loss risk | Must fix |
| Major | Bug, broken functionality | Should fix |
| Minor | Style, optimization | Nice to fix |
| Suggestion | Improvement opportunity | Optional |

## Common Issues

### Security
- Hardcoded API keys, passwords, tokens
- SQL injection vulnerabilities
- XSS vulnerabilities
- Missing input validation
- Insecure random number generation

### Code Quality
- Unused variables or imports
- Missing error handling
- Inconsistent naming
- Magic numbers (should be constants)
- Duplicate code

### Performance
- Inefficient loops
- Missing memoization
- Unnecessary re-renders (for UI)
- Large bundle sizes

## Return Contract

See [return-contract.md](../references/return-contract.md).

## Safety Rules

1. **NEVER modify files** - Read-only review
2. **ALWAYS provide specific line numbers** - For issues found
3. **NEVER mark as approved** - Without thorough review
4. **ALWAYS explain reasoning** - For all issues
5. **NEVER skip security checks** - Even for "quick" reviews

See [safety-rules.md](../references/safety-rules.md#read-only-operations) for patterns.

## Error Handling

- **If file doesn't exist**: Report missing file, suggest checking file path
- **If linter not configured**: Report missing tool, suggest installation, offer manual review
- **If syntax errors found**: Report as critical issue, do not proceed with review, suggest fixing syntax first

See [error-handling.md](../references/error-handling.md) for patterns.

## Example

```
User: /skill code-reviewer --review src/auth.ts

Status: SUCCESS

Summary:
- Reviewed src/auth.ts (187 lines)
- Found 4 issues (1 critical, 1 major, 2 suggestions)
- 1 potential security issue detected

Files changed:
- None (read-only review)

Commands run:
- eslint src/auth.ts
- Manual security review
- Pattern analysis

Evidence:
Critical:
- Line 67: Hardcoded API key 'sk_test_...' - Move to environment variable

Major:
- Line 92: Missing try/catch around async operation

Suggestions:
- Line 45: Consider extracting to validateCredentials() function
- Line 134: Add JSDoc for public API

Next recommended:
- Fix critical security issue before committing
- Consider addressing major issue
```
