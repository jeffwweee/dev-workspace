---
name: tester
description: "Testing and verification for dev-workspace projects. Runs tests, smoke tests, and verification to ensure code works correctly. Use for running test suite, verifying specific functionality, creating smoke tests, reproducing bugs, verifying fixes, and any quality assurance before marking tasks complete."
---

# Tester

## Overview

Runs tests, smoke tests, and verification to ensure code works correctly.

## Commands

### Run Tests

Run test suite (all or specific):

```bash
/tester --run --suite unit
```

**Suites:** `unit`, `integration`, `e2e`, `all`

### Verify Feature

Verify specific feature works as expected:

```bash
/tester --verify "user login"
```

### Smoke Test

Run quick smoke tests to verify basic functionality:

```bash
/tester --smoke-test
```

### Reproduce Bug

Attempt to reproduce a reported bug:

```bash
/tester --reproduce "Login fails with invalid credentials"
```

### Verify Fix

Verify that a bug fix resolves the issue:

```bash
/tester --verify-fix "Login now handles invalid credentials"
```

### Coverage Report

Generate and analyze test coverage:

```bash
/tester --coverage
```

## Test Categories

### Unit Tests
- Test individual functions/components
- Fast, isolated
- Mock external dependencies

### Integration Tests
- Test component interactions
- Slower, real dependencies
- Database/API calls

### Smoke Tests
- Quick functionality checks
- Critical paths only
- Fast verification

### E2E Tests
- Full user workflows
- Slowest, most realistic
- Browser/app automation

## Smoke Test Template

Basic smoke tests to run:
```bash
# Build succeeds
npm run build

# No lint errors
npm run lint

# Basic functionality
npm run smoke-test
```

## Verification Checklist

### Before Marking Complete
- [ ] All unit tests pass
- [ ] Integration tests pass
- [ ] Smoke tests pass
- [ ] No console errors
- [ ] Edge cases tested
- [ ] Error handling works
- [ ] Performance acceptable

### For Bug Fixes
- [ ] Bug reproducible (before fix)
- [ ] Bug no longer occurs (after fix)
- [ ] No regressions introduced
- [ ] Edge cases covered

## Success Criteria

| Metric | Pass Threshold |
|--------|---------------|
| Unit tests | 100% pass |
| Integration tests | 100% pass |
| Smoke tests | 100% pass |
| Coverage | Project-specific (usually >80%) |

## Common Failure Patterns

| Pattern | Likely Cause | Fix |
|---------|--------------|-----|
| All tests fail | Test setup issue | Check test config |
| Specific test fails | Code regression | Review recent changes |
| Flaky tests | Timing/async issues | Add proper waits/mocks |
| Coverage drop | New code untested | Add tests for new code |

## Return Contract

See [return-contract.md](../references/return-contract.md).

## Safety Rules

1. **NEVER modify code** - During testing
2. **ALWAYS report all failures** - Don't hide issues
3. **NEVER skip tests** - Without documentation
4. **ALWAYS include test output** - In evidence section
5. **NEVER mark as passed** - If tests fail

See [safety-rules.md](../references/safety-rules.md#testing-operations) for patterns.

## Error Handling

- **If tests fail**: Report all failing tests, include error messages, suggest fixes, do NOT mark task as passed
- **If test framework not configured**: Report missing setup, suggest initialization, offer to create basic tests
- **If coverage is low**: Report current coverage, suggest areas to improve, do NOT block on coverage unless required

See [error-handling.md](../references/error-handling.md) for patterns.

## Example

```
User: /tester --run

Status: SUCCESS

Summary:
- Ran all test suites
- 42 tests passed, 0 failed
- Coverage: 87% (above 80% threshold)

Files changed:
- None (read-only)

Commands run:
- npm test
- npm run test:coverage

Evidence:
Test Suites: 5 passed, 5 total
Tests: 42 passed, 42 total
Snapshots: 0 total
Time: 3.456s

Coverage:
- Statements: 87% (456/524)
- Branches: 85% (234/276)
- Functions: 89% (123/138)
- Lines: 86% (445/518)

Next recommended:
- node bin/dw.js record-result --task TASK-001 --status passed
```
