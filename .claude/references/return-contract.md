# Return Contract

## Overview

ALL skills in the dev-workspace MUST return results in this standard format. This ensures consistency, traceability, and proper handoffs between skills.

## Standard Format

```
Status: SUCCESS|FAILURE|PARTIAL|BLOCKED

Summary:
- Bullet point 1
- Bullet point 2

Files changed:
- path/to/file1.ts
- path/to/file2.ts

Commands run:
- command1
- command2

Evidence:
- Proof of working (test output, etc.)

Next recommended:
- Single next action or "none"
```

## Status Values

| Status | Meaning | When to Use |
|--------|---------|-------------|
| `SUCCESS` | Task completed fully | All work done, tests pass |
| `FAILURE` | Task could not complete | Error occurred, blocked by issue |
| `PARTIAL` | Task partially complete | Some work done, more needed |
| `BLOCKED` | Cannot proceed | External dependency missing |

## Section Requirements

### Summary
- 1-5 bullet points
- Past tense, factual
- What was accomplished or attempted

### Files Changed
- List all modified/created files
- Use relative paths from project root
- Write "None (read-only)" if no changes

### Commands Run
- List all shell commands executed
- Include relevant flags
- Write "None (direct file edit)" if no commands

### Evidence
- Concrete proof of success/failure
- Test output, lint results, screenshots
- Error messages if failed

### Next Recommended
- Single recommended action
- Use `node bin/dw.js` command or skill invocation
- Write "none" if no further action needed

## Example

```
Status: SUCCESS

Summary:
- Implemented user authentication feature
- Added OAuth2 providers (Google, GitHub)
- Created tests (all passing)

Files changed:
- src/auth/oauth.ts
- src/auth/providers/google.ts
- src/auth/providers/github.ts
- tests/auth/oauth.test.ts

Commands run:
- npm test
- npm run lint
- git add .

Evidence:
- All tests passing (42/42)
- Coverage: 89%
- No lint errors

Next recommended:
- node bin/dw.js record-result --task TASK-001 --status passed
```
