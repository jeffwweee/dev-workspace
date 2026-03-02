# QA Compliance Test Plan

**Task ID:** QA-COMPLIANCE-001
**Created:** 2026-03-02
**Agent:** qa (bulbasaur)
**Purpose:** Verify QA Developer role skill implementation compliance

## Overview

This test plan verifies that the QA Developer role skill (`qa-developer`) was properly implemented according to the specifications in `docs/plans/2026-03-02-persona-role-skills-implementation.md` Task 4.

## Acceptance Criteria

### AC1: Skill File Structure
- [ ] `.claude/skills/qa-developer/SKILL.md` exists
- [ ] File has valid YAML frontmatter with required fields
- [ ] Required frontmatter fields: `name`, `type: role`, `description`, `references.skills`

### AC2: Role Metadata
- [ ] `name: qa-developer`
- [ ] `type: role`
- [ ] Description mentions QA responsibilities
- [ ] All referenced skills are listed

### AC3: Referenced Skills
- [ ] `dev-test` - for testing utilities
- [ ] `review-verify` - for final verification
- [ ] `review-code` - for code review
- [ ] `dev-docs` - for documentation
- [ ] `dev-git` - for git operations
- [ ] `task-complete` - for task completion

### AC4: Documentation Content
- [ ] Overview section explaining QA role
- [ ] Domain Knowledge section covering testing, verification, documentation
- [ ] Referenced Skills table with purpose and when-to-use
- [ ] Completion Workflow section
- [ ] Critical Rules section

### AC5: Completion Workflow
- [ ] Workflow order documented: `review-code → dev-test → review-verify → dev-docs → dev-git → task-complete`
- [ ] Each step has clear purpose description

### AC6: Critical Rules
- [ ] "Never skip verification" rule present
- [ ] "Evidence before assertions" rule present
- [ ] "Document decisions" rule present

### AC7: Integration
- [ ] Skill loads correctly via `/qa-developer` command
- [ ] Skill provides identity context (QA assistant)
- [ ] Referenced skills can be invoked

## Test Execution

### Test 1: File Structure Verification

```bash
# Check skill file exists
ls -la .claude/skills/qa-developer/SKILL.md

# Verify frontmatter
head -20 .claude/skills/qa-developer/SKILL.md
```

Expected: File exists, YAML frontmatter starts with `---`

### Test 2: Role Metadata Verification

```bash
# Extract and validate YAML frontmatter
npx tsx -e "
import * as fs from 'fs';
import * as yaml from 'js-yaml';
const content = fs.readFileSync('.claude/skills/qa-developer/SKILL.md', 'utf-8');
const match = content.match(/^---\n([\s\S]*?)\n---/);
if (!match) throw new Error('No frontmatter');
const frontmatter = yaml.load(match[1]);
console.log(JSON.stringify(frontmatter, null, 2));
if (frontmatter.name !== 'qa-developer') throw new Error('Wrong name');
if (frontmatter.type !== 'role') throw new Error('Wrong type');
if (!frontmatter.references?.skills) throw new Error('Missing skills reference');
console.log('✓ Metadata valid');
"
```

Expected: No errors, shows metadata with correct values

### Test 3: Referenced Skills Verification

```bash
# Check all referenced skills exist
npx tsx -e "
import * as fs from 'fs';
import * as yaml from 'js-yaml';
const content = fs.readFileSync('.claude/skills/qa-developer/SKILL.md', 'utf-8');
const match = content.match(/^---\n([\s\S]*?)\n---/);
const frontmatter = yaml.load(match[1]);
const skills = frontmatter.references.skills;
const required = ['dev-test', 'review-verify', 'review-code', 'dev-docs', 'dev-git', 'task-complete'];
for (const skill of required) {
  if (!skills.includes(skill)) throw new Error(\`Missing skill: \${skill}\`);
  const path = \`.claude/skills/\${skill}/SKILL.md\`;
  if (!fs.existsSync(path)) throw new Error(\`Skill file missing: \${skill}\`);
}
console.log('✓ All required skills referenced and exist');
"
```

Expected: All 6 required skills are referenced

### Test 4: Content Structure Verification

```bash
# Check required sections exist
grep -E "^(#|##)" .claude/skills/qa-developer/SKILL.md | head -20
```

Expected output:
```
# QA Developer
## Overview
## Domain Knowledge
## Referenced Skills
## Completion Workflow
## Critical Rules
```

### Test 5: Integration Test

```bash
# Spawn a test agent with qa-developer role
# (This is a manual verification step)

# Check the skill can be loaded
ls -la .claude/skills/qa-developer/

# Verify the skill file format
file .claude/skills/qa-developer/SKILL.md
```

## Success Criteria

- All 7 Acceptance Criteria pass
- All 5 Test Executions pass
- Skill is ready for use in multi-agent workflows

## Notes

- This is a compliance test, not an integration test
- Testing is against the implementation plan spec (Task 4 of persona-role-skills-implementation.md)
- No actual code execution required - this is structural verification

## Sign-off

| Agent | Date | Status |
|-------|------|--------|
| qa (bulbasaur) | TBD | Pending |
| orchestrator | TBD | Pending |
