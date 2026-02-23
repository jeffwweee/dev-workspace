# Telegram Reply Templates

Predefined templates for common Telegram responses. Use with `--template <name>`.

## Acknowledgment

**Template:** `ack`

Quick acknowledgment that message was received.

```
👍 Got it\!
```

## Status Update

**Template:** `status-update`

Progress update on current work.

```
📊 *Status Update*

Task: {{task_id}}
Status: {{status}}
Progress: {{progress}}%

{{details}}
```

**Variables:**
- `task_id` — Task ID (e.g., V2-017)
- `status` — Current status (in_progress, blocked, etc.)
- `progress` — Percentage complete
- `details` — Additional details

## Ask Clarification

**Template:** `ask-clarification`

Request more information from user.

```
❓ *Need Clarification*

{{question}}

Options:
{{#each options}}
{{@index}}\. {{this}}
{{/each}}
```

**Variables:**
- `question` — What you need clarified
- `options` — Array of options (optional)

## Task Complete

**Template:** `task-complete`

Notify task completion.

```
✅ *Task Complete*

Task: {{task_id}}
Duration: {{duration}}

*Summary:*
{{summary}}

*Files changed:*
{{#each files}}
• {{this}}
{{/each}}
```

**Variables:**
- `task_id` — Task ID
- `duration` — Time taken
- `summary` — What was done
- `files` — Array of changed files

## Error Report

**Template:** `error-report`

Report an error or blocker.

```
⚠️ *Error Report*

Task: {{task_id}}
Error: {{error}}

*Context:*
{{context}}

*Next steps:*
{{next_steps}}
```

**Variables:**
- `task_id` — Task ID
- `error` — Error message
- `context` — What was happening
- `next_steps` — What needs to happen

## Waiting

**Template:** `waiting`

Notify that Claude is waiting for something.

```
⏳ *Waiting*

{{what}}
Expected: {{expected_time}}
```

**Variables:**
- `what` — What we're waiting for
- `expected_time` — When it should resolve (optional)

## Session Start

**Template:** `session-start`

Announce session start.

```
🚀 *Session Started*

Session: {{session_id}}
Project: {{project}}
Focus: {{focus}}
```

## Session End

**Template:** `session-end`

Announce session end.

```
🏁 *Session Ended*

Duration: {{duration}}
Tasks completed: {{tasks_completed}}
Summary: {{summary}}
```

## Custom Templates

Add custom templates to `~/.claude/skills/telegram-reply/custom-templates.md`:

```markdown
## My Custom Template

**Template:** `my-template`

```
Your custom message here with {{variables}}.
```
```
