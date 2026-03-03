---
name: using-skills
description: Use when starting any conversation - establishes how to find and use skills. Invoke BEFORE any response including clarifying questions. This is the meta-skill for skill invocation discipline.
---

<EXTREMELY-IMPORTANT>
If you think there is even 1% chance a skill might apply to what you are doing, you ABSOLUTELY MUST invoke the skill.

IF A SKILL APPLIES TO YOUR TASK, YOU DO NOT HAVE A CHOICE. YOU MUST USE IT.

This is not negotiable. This is not optional. You cannot rationalize your way out of this.
</EXTREMELY-IMPORTANT>

# Using Skills

## The Rule

**Invoke relevant or requested skills BEFORE any response or action.** Even a 1% chance a skill might apply means that you should invoke the skill to check.

```
User message received
    ↓
Might any skill apply? ──[yes, even 1%]──→ Invoke Skill tool
    ↓                                              ↓
    ↓ [definitely not]                      Announce: "Using [skill] to [purpose]"
    ↓                                              ↓
Respond (including clarifications)           Follow skill exactly
```

## Skill Categories

This workspace uses category-prefixed skills for clarity:

| Category | Purpose | Examples |
|----------|---------|----------|
| `plan-*` | Planning and execution | `plan-create`, `plan-execute`, `plan-parallel` |
| `review-*` | Quality assurance | `review-code`, `review-verify` |
| `dev-*` | Development operations | `dev-git`, `dev-test`, `dev-docs`, `dev-debug` |
| `comm-*` | Communication | `comm-brainstorm`, `comm-telegram`, `comm-reply` |
| `task-*` | Task management | `task-register`, `task-complete` |

## Skill Priority

When multiple skills could apply, use this order:

1. **Process skills first** (`comm-brainstorm`, `dev-debug`) - these determine HOW to approach the task
2. **Implementation skills second** (`dev-git`, `dev-test`) - these guide execution

Example:
- "Let's build X" → `comm-brainstorm` first, then implementation skills
- "Fix this bug" → `dev-debug` first, then domain-specific skills
- "Execute this plan" → Check task independence, then `plan-parallel` or `plan-execute`

## Red Flags

These thoughts mean STOP—you're rationalizing:

| Thought | Reality |
|---------|---------|
| "This is just a simple question" | Questions are tasks. Check for skills. |
| "I need more context first" | Skill check comes BEFORE clarifying questions. |
| "Let me explore the codebase first" | Skills tell you HOW to explore. Check first. |
| "I can check git/files quickly" | Files lack conversation context. Check for skills. |
| "This doesn't need a formal skill" | If a skill exists, use it. |
| "I remember this skill" | Skills evolve. Read current version. |
| "The skill is overkill" | Simple things become complex. Use it. |
| "I'll just do this one thing first" | Check BEFORE doing anything. |
| "This feels productive" | Undisciplined action wastes time. Skills prevent this. |

## Skill Types

**Rigid** (`dev-debug`, `dev-test`): Follow exactly. Don't adapt away discipline.

**Flexible** (`comm-brainstorm`): Adapt principles to context.

The skill itself tells you which.

## How to Access Skills

**In Claude Code:** Use the `Skill` tool. When you invoke a skill, its content is loaded—follow it directly. Never use Read tool on skill files.

**External skills:** Reference as `superpowers:skill-name`

## User Instructions

Instructions say WHAT, not HOW. "Add X" or "Fix Y" doesn't mean skip workflows.

## Integration with Orchestrator

The orchestrator (`bin/cc-orch.ts`) routes tasks to appropriate skills:

1. Plan file detected → `plan-create` or `plan-parallel`
2. Code changes → `review-code`
3. Tests needed → `dev-test`
4. Bug reported → `dev-debug`
5. Feature request → `comm-brainstorm`

The orchestrator invokes this `using-skills` meta-skill to determine which skill applies before any action.
