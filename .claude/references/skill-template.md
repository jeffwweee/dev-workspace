# Skill Template

Use this template when creating new skills for the dev-workspace.

---

```markdown
---
name: <skill-name>
description: "<Brief description. Use for <use case 1>, <use case 2>, and <use case 3>."
---

# <Skill Name>

## Overview

<1-2 sentences describing what this skill does>

## Commands

### <Command 1>

<Description of command>:

```bash
/skill <skill-name> --<flag> <value>
```

**Options:** `<option1>`, `<option2>`

### <Command 2>

<Description of command>:

```bash
/skill <skill-name> --<flag>
```

## <Skill-Specific Section>

<Add sections specific to this skill's domain>

### Template/Schema

```json
{
  "field": "description"
}
```

## Return Contract

See [return-contract.md](../references/return-contract.md).

## Safety Rules

1. **NEVER <action>** - <reason>
2. **ALWAYS <action>** - <reason>
3. **NEVER <action>** - <reason>
4. **ALWAYS <action>** - <reason>

See [safety-rules.md](../references/safety-rules.md) for patterns.

## Error Handling

- If <condition>: <action>
- If <condition>: <action>

See [error-handling.md](../references/error-handling.md) for patterns.

## Example

```
User: /skill <skill-name> --<flag>

Status: SUCCESS

Summary:
- <what was done 1>
- <what was done 2>

Files changed:
- <file paths>

Commands run:
- <commands>

Evidence:
- <proof>

Next recommended:
- <next action>
```
```

---

## Required Sections

Every skill MUST have:

1. **Frontmatter** - name and description
2. **Overview** - Brief description
3. **Commands** - Available commands/flags
4. **Return Contract** - Link or inline format
5. **Safety Rules** - 4-6 NEVER/ALWAYS rules
6. **Error Handling** - Common error patterns
7. **Example** - Full example output

## Optional Sections

Add as needed:

- Templates/Schemas
- Tables (priority levels, categories, etc.)
- Checklists
- Diagrams
- Code examples

## Naming Conventions

- **Skill name**: kebab-case (e.g., `code-reviewer`)
- **Commands**: kebab-case flags (e.g., `--checkout-branch`)
- **Files**: `SKILL.md` in directory matching skill name

## Directory Structure

```
.claude/skills/
└── <skill-name>/
    └── SKILL.md
```
