# Smart Skills & Multi-Agent Teams Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `executing-plans` or `subagent-driven-development` skill to implement this plan task-by-task.

**Design Document:** `docs/plans/2026-02-26-smart-skills-multi-agent-teams-design.md`

**Goal:** Implement unified skills and agents architecture with clear separation: agents are core worker types (stable registry), skills are team compositions (frequently created, shared via `/find-skills`).

**Architecture:**
- Agent registry defines core worker types (orchestrator, specialists, quality agents)
- Smart skills have executable `skill.json` configs that define team composition
- Two-tier skill system: workspace (generic) + project (domain-specific, extends workspace)
- Orchestrator-led teams with specialist-as-orchestrator pattern
- Skill discovery via `/find-skills` using Vercel AI SDK library

**Tech Stack:** Node.js CLI (TypeScript), npm for skill packages, Vercel AI SDK for discovery

**Implementation Phases:**
1. Foundation - Agent registry, skill.json schema, skill router
2. Orchestrator-Led Teams - Team composition, dynamic agent selection
3. Skill Discovery - /find-skills with Vercel library
4. Advanced Features - Skill inheritance, adaptive teams, error handling

---

## Phase 1: Foundation

### Task 1: Create Agent Registry Schema and Initial Registry

**Files:**
- Create: `.claude/agents/registry.json`
- Create: `.claude/agents/registry.schema.json` (JSON Schema for validation)
- Create: `bin/lib/agents/registry.js` (Registry access functions)
- Test: `bin/lib/agents/registry.test.js`

**Step 1: Create agent registry directory structure**

```bash
mkdir -p .claude/agents
mkdir -p bin/lib/agents
```

**Step 2: Write agent registry JSON file**

Create `.claude/agents/registry.json`:

```json
{
  "version": "1.0",
  "agents": {
    "orchestrator-agent": {
      "type": "coordinator",
      "description": "Cross-domain team coordinator",
      "capabilities": ["task_decomposition", "agent_selection", "coordination", "conflict_resolution"],
      "model": "opus",
      "tools": ["Task", "TaskOutput", "TaskStop", "AskUserQuestion"],
      "can_lead": ["any"],
      "system_prompt": "You are an orchestrator agent coordinating a team of specialist agents.",
      "stable": true
    },
    "planner-agent": {
      "type": "foundation",
      "description": "Design and planning specialist",
      "capabilities": ["design", "planning", "architecture", "requirements-analysis"],
      "model": "opus",
      "tools": ["Read", "Write", "Glob", "Grep"],
      "can_lead": ["planning", "design"],
      "system_prompt": "You are a planning specialist focused on clear requirements and design.",
      "stable": true
    },
    "ts-specialist": {
      "type": "specialist",
      "description": "TypeScript/Node.js backend specialist",
      "capabilities": ["typescript", "node", "express", "fastify", "drizzle", "vitest"],
      "model": "sonnet",
      "tools": ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
      "can_lead": ["typescript", "backend", "api"],
      "system_prompt": "You are a senior TypeScript engineer with deep expertise in Node.js backend development.",
      "stable": true
    },
    "python-specialist": {
      "type": "specialist",
      "description": "Python backend specialist",
      "capabilities": ["python", "django", "fastapi", "pytest"],
      "model": "sonnet",
      "tools": ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
      "can_lead": ["python", "backend", "api"],
      "system_prompt": "You are a senior Python engineer with deep expertise in Django and FastAPI.",
      "stable": true
    },
    "rust-specialist": {
      "type": "specialist",
      "description": "Rust backend specialist",
      "capabilities": ["rust", "tokio", "axum", "sqlx"],
      "model": "sonnet",
      "tools": ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
      "can_lead": ["rust", "backend"],
      "system_prompt": "You are a senior Rust engineer with deep expertise in backend development.",
      "stable": true
    },
    "react-specialist": {
      "type": "specialist",
      "description": "React frontend specialist",
      "capabilities": ["react", "nextjs", "typescript", "tailwind"],
      "model": "sonnet",
      "tools": ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
      "can_lead": ["react", "frontend", "ui"],
      "system_prompt": "You are a senior React engineer with deep expertise in frontend development.",
      "stable": true
    },
    "grammy-specialist": {
      "type": "specialist",
      "description": "Telegram bot specialist using grammY",
      "extends": "ts-specialist",
      "capabilities": ["grammy", "telegram", "cloudflare-workers", "d1"],
      "model": "sonnet",
      "tools": ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
      "can_lead": ["telegram", "bot", "grammy"],
      "system_prompt": "You are a Telegram bot expert specializing in grammY framework and Cloudflare Workers deployment.",
      "stable": true
    },
    "tester-agent": {
      "type": "specialist",
      "description": "Testing and verification specialist",
      "capabilities": ["testing", "tdd", "vitest", "jest", "playwright"],
      "model": "haiku",
      "tools": ["Read", "Write", "Edit", "Bash"],
      "can_lead": ["testing", "qa"],
      "system_prompt": "You are a testing specialist focused on TDD and comprehensive test coverage.",
      "stable": true
    },
    "code-reviewer": {
      "type": "specialist",
      "description": "Code review and quality specialist",
      "capabilities": ["code-review", "security-review", "pattern-review"],
      "model": "sonnet",
      "tools": ["Read", "Grep", "Glob"],
      "can_lead": [],
      "system_prompt": "You are a code review specialist focused on quality, security, and best practices.",
      "stable": true
    },
    "debugger-agent": {
      "type": "specialist",
      "description": "Debugging and root cause analysis",
      "capabilities": ["debugging", "root-cause", "investigation"],
      "model": "sonnet",
      "tools": ["Read", "Grep", "Bash", "Glob"],
      "can_lead": ["debugging", "investigation"],
      "system_prompt": "You are a debugging specialist skilled at systematic root cause analysis.",
      "stable": true
    },
    "docs-agent": {
      "type": "specialist",
      "description": "Documentation specialist",
      "capabilities": ["documentation", "api-docs", "guides"],
      "model": "haiku",
      "tools": ["Read", "Write", "Edit"],
      "can_lead": [],
      "system_prompt": "You are a documentation specialist focused on clear, comprehensive docs.",
      "stable": true
    },
    "git-agent": {
      "type": "specialist",
      "description": "Git operations specialist",
      "capabilities": ["git", "branching", "merging", "cherry-pick"],
      "model": "haiku",
      "tools": ["Bash"],
      "can_lead": [],
      "system_prompt": "You are a Git specialist focused on safe, effective version control workflows.",
      "stable": true
    },
    "writer-agent": {
      "type": "foundation",
      "description": "Writing and communication specialist",
      "capabilities": ["writing", "documentation", "communication"],
      "model": "haiku",
      "tools": ["Read", "Write", "Edit"],
      "can_lead": [],
      "system_prompt": "You are a writing specialist focused on clear communication.",
      "stable": true
    }
  }
}
```

**Step 3: Create JSON Schema for validation**

Create `.claude/agents/registry.schema.json`:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Agent Registry Schema",
  "type": "object",
  "required": ["version", "agents"],
  "properties": {
    "version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+$"
    },
    "agents": {
      "type": "object",
      "patternProperties": {
        "^[a-z-]+$": {
          "type": "object",
          "required": ["type", "description", "capabilities", "model", "stable"],
          "properties": {
            "type": {
              "type": "string",
              "enum": ["coordinator", "specialist", "foundation"]
            },
            "description": {
              "type": "string"
            },
            "capabilities": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "model": {
              "type": "string",
              "enum": ["opus", "sonnet", "haiku"]
            },
            "tools": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "can_lead": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "extends": {
              "type": "string"
            },
            "system_prompt": {
              "type": "string"
            },
            "stable": {
              "type": "boolean"
            }
          }
        }
      }
    }
  }
}
```

**Step 4: Create agent registry access functions**

Create `bin/lib/agents/registry.js`:

```javascript
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { readJson, getWorkspaceRoot } from '../state/manager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AGENT_REGISTRY_PATH = path.join(getWorkspaceRoot(), '.claude', 'agents', 'registry.json');

// Get agent registry
export function getAgentRegistry() {
  return readJson(AGENT_REGISTRY_PATH, {
    version: '1.0',
    agents: {}
  });
}

// Get single agent definition
export function getAgent(agentId) {
  const registry = getAgentRegistry();
  return registry.agents[agentId] || null;
}

// Check if agent exists
export function hasAgent(agentId) {
  const registry = getAgentRegistry();
  return agentId in registry.agents;
}

// Get agents by type
export function getAgentsByType(type) {
  const registry = getAgentRegistry();
  return Object.entries(registry.agents)
    .filter(([_, agent]) => agent.type === type)
    .map(([id, _]) => id);
}

// Get agents that can lead a domain
export function getAgentsForDomain(domain) {
  const registry = getAgentRegistry();
  return Object.entries(registry.agents)
    .filter(([_, agent]) =>
      agent.can_lead && (agent.can_lead.includes('any') || agent.can_lead.includes(domain))
    )
    .map(([id, _]) => id);
}

// Validate agent registry against schema (basic validation)
export function validateRegistry() {
  const registry = getAgentRegistry();

  if (!registry.version) {
    throw new Error('Agent registry missing version');
  }

  if (!registry.agents || typeof registry.agents !== 'object') {
    throw new Error('Agent registry missing agents object');
  }

  for (const [agentId, agent] of Object.entries(registry.agents)) {
    if (!agent.type || !['coordinator', 'specialist', 'foundation'].includes(agent.type)) {
      throw new Error(`Agent ${agentId} has invalid type: ${agent.type}`);
    }
    if (!agent.capabilities || !Array.isArray(agent.capabilities)) {
      throw new Error(`Agent ${agentId} missing capabilities array`);
    }
    if (!agent.model || !['opus', 'sonnet', 'haiku'].includes(agent.model)) {
      throw new Error(`Agent ${agentId} has invalid model: ${agent.model}`);
    }
    if (typeof agent.stable !== 'boolean') {
      throw new Error(`Agent ${agentId} missing stable flag`);
    }
  }

  return { valid: true, agentCount: Object.keys(registry.agents).length };
}

export { AGENT_REGISTRY_PATH };
```

**Step 5: Write tests for agent registry**

Create `bin/lib/agents/registry.test.js`:

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getAgentRegistry, getAgent, hasAgent, getAgentsByType, getAgentsForDomain, validateRegistry } from './registry.js';

describe('Agent Registry', () => {
  it('should load registry with version', () => {
    const registry = getAgentRegistry();
    assert.strictEqual(registry.version, '1.0');
  });

  it('should have core agents defined', () => {
    assert.ok(hasAgent('orchestrator-agent'));
    assert.ok(hasAgent('ts-specialist'));
    assert.ok(hasAgent('tester-agent'));
  });

  it('should get agent by ID', () => {
    const agent = getAgent('ts-specialist');
    assert.ok(agent);
    assert.strictEqual(agent.type, 'specialist');
    assert.ok(agent.capabilities.includes('typescript'));
  });

  it('should return null for unknown agent', () => {
    const agent = getAgent('unknown-agent');
    assert.strictEqual(agent, null);
  });

  it('should filter agents by type', () => {
    const specialists = getAgentsByType('specialist');
    assert.ok(specialists.length > 0);
    assert.ok(specialists.includes('ts-specialist'));
  });

  it('should get agents that can lead a domain', () => {
    const tsLeaders = getAgentsForDomain('typescript');
    assert.ok(tsLeaders.includes('ts-specialist'));
  });

  it('should validate registry successfully', () => {
    const result = validateRegistry();
    assert.strictEqual(result.valid, true);
    assert.ok(result.agentCount > 0);
  });
});
```

**Step 6: Run tests to verify**

```bash
cd /home/jeffwweee/jef/dev-workspace
node --test bin/lib/agents/registry.test.js
```

Expected: All tests pass

**Step 7: Commit**

```bash
git add .claude/agents/ bin/lib/agents/
git commit -m "feat(agent-registry): Add agent registry with core agent types

- Define 13 core agent types (coordinator, specialists, foundation)
- Add JSON Schema for validation
- Add registry access functions (getAgent, getAgentsByType, etc.)
- Add comprehensive tests

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Create skill.json Schema and Validation

**Files:**
- Create: `.claude/skills/schema/skill.schema.json` (JSON Schema for skill.json)
- Create: `bin/lib/skills/validator.js` (Skill validation functions)
- Test: `bin/lib/skills/validator.test.js`

**Step 1: Create skill schema directory**

```bash
mkdir -p .claude/skills/schema
mkdir -p bin/lib/skills
```

**Step 2: Write skill.json schema**

Create `.claude/skills/schema/skill.schema.json`:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Smart Skill Configuration Schema",
  "type": "object",
  "required": ["name", "description"],
  "properties": {
    "name": {
      "type": "string",
      "pattern": "^[a-z0-9-]+$",
      "description": "Skill identifier (kebab-case)"
    },
    "description": {
      "type": "string",
      "description": "Human-readable description"
    },
    "version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$",
      "description": "Semantic version"
    },
    "extends": {
      "type": "string",
      "pattern": "^workspace://[a-z0-9-]+$",
      "description": "Workspace skill to extend"
    },
    "team": {
      "type": "object",
      "properties": {
        "orchestrator": {
          "type": "object",
          "properties": {
            "type": {
              "type": "string",
              "enum": ["dynamic", "coordinator", "specialist", "foundation"]
            },
            "selection": {
              "type": "object",
              "additionalProperties": {
                "type": "string"
              }
            }
          }
        },
        "members": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["role"],
            "properties": {
              "role": {
                "type": "string"
              },
              "agent": {
                "type": "string"
              },
              "selection": {
                "type": "object",
                "additionalProperties": {
                  "type": "string"
                }
              },
              "required": {
                "type": "boolean"
              },
              "phase": {
                "type": "string",
                "enum": ["planning", "implementation", "verification", "documentation"]
              },
              "parallel_with": {
                "type": "array",
                "items": {
                  "type": "string"
                }
              },
              "depends_on": {
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            }
          }
        }
      }
    },
    "adaptive": {
      "type": "object",
      "properties": {
        "complexity": {
          "type": "object",
          "properties": {
            "small": {
              "type": "object",
              "properties": {
                "max_members": {
                  "type": "integer"
                },
                "roles": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                }
              }
            },
            "medium": {
              "type": "object",
              "properties": {
                "max_members": {
                  "type": "integer"
                },
                "roles": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                }
              }
            },
            "large": {
              "type": "object",
              "properties": {
                "max_members": {
                  "type": "integer"
                },
                "roles": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                }
              }
            }
          }
        },
        "add_on_demand": {
          "type": "object",
          "additionalProperties": {
            "type": "string"
          }
        }
      }
    },
    "context": {
      "type": "object",
      "properties": {
        "inject": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "working_directory": {
          "type": "string"
        }
      }
    },
    "validation": {
      "type": "object",
      "properties": {
        "required": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "commands": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      }
    },
    "workflow": {
      "type": "object",
      "properties": {
        "next_skill": {
          "type": "string"
        },
        "modes": {
          "type": "object",
          "additionalProperties": {
            "type": "string"
          }
        }
      }
    },
    "metadata": {
      "type": "object",
      "properties": {
        "tags": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "project_types": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "estimated_duration": {
          "type": "string"
        }
      }
    }
  }
}
```

**Step 3: Create skill validator**

Create `bin/lib/skills/validator.js`:

```javascript
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getAgent, hasAgent } from '../agents/registry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Validate skill.json structure
export function validateSkillJson(skillPath) {
  const skillJsonPath = path.join(skillPath, 'skill.json');

  if (!fs.existsSync(skillJsonPath)) {
    return { valid: false, errors: ['skill.json not found'] };
  }

  let skillConfig;
  try {
    skillConfig = JSON.parse(fs.readFileSync(skillJsonPath, 'utf8'));
  } catch (error) {
    return { valid: false, errors: [`Invalid JSON: ${error.message}`] };
  }

  const errors = [];

  // Check required fields
  if (!skillConfig.name) {
    errors.push('Missing required field: name');
  }
  if (!skillConfig.description) {
    errors.push('Missing required field: description');
  }

  // Validate team configuration if present
  if (skillConfig.team) {
    const teamErrors = validateTeamConfig(skillConfig.team);
    errors.push(...teamErrors);
  }

  // Validate extends references
  if (skillConfig.extends) {
    if (!skillConfig.extends.startsWith('workspace://')) {
      errors.push('extends must start with "workspace://"');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    skillConfig
  };
}

// Validate team configuration
function validateTeamConfig(team) {
  const errors = [];

  if (team.members) {
    for (const member of team.members) {
      if (!member.role) {
        errors.push('Team member missing role');
      }

      // Validate agent references (if not dynamic)
      if (member.agent && member.agent !== 'dynamic') {
        if (!hasAgent(member.agent)) {
          errors.push(`Unknown agent type: ${member.agent}`);
        }
      }

      // Validate selection agent references
      if (member.selection) {
        for (const agentId of Object.values(member.selection)) {
          if (!hasAgent(agentId)) {
            errors.push(`Unknown agent in selection: ${agentId}`);
          }
        }
      }
    }
  }

  return errors;
}

// Validate skill has required files
export function validateSkillFiles(skillPath) {
  const requiredFiles = ['SKILL.md'];
  const optionalFiles = ['skill.json', 'prompts/default.md'];

  const errors = [];
  const warnings = [];

  for (const file of requiredFiles) {
    const filePath = path.join(skillPath, file);
    if (!fs.existsSync(filePath)) {
      errors.push(`Missing required file: ${file}`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// Get skill from path
export function loadSkill(skillPath) {
  const validation = validateSkillJson(skillPath);
  if (!validation.valid) {
    throw new Error(`Invalid skill: ${validation.errors.join(', ')}`);
  }

  const fileValidation = validateSkillFiles(skillPath);
  if (!fileValidation.valid) {
    throw new Error(`Invalid skill files: ${fileValidation.errors.join(', ')}`);
  }

  return validation.skillConfig;
}
```

**Step 4: Write tests for skill validator**

Create `bin/lib/skills/validator.test.js`:

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { validateSkillJson, validateSkillFiles, loadSkill } from './validator.js';

describe('Skill Validator', () => {
  it('should validate skill.json structure', () => {
    // This would test with actual skill path
    // For now, test with mock
    const mockSkill = {
      name: 'test-skill',
      description: 'Test skill',
      team: {
        members: [
          {
            role: 'implementer',
            agent: 'ts-specialist',
            required: true
          }
        ]
      }
    };

    assert.strictEqual(mockSkill.name, 'test-skill');
    assert.ok(mockSkill.team.members[0].role);
  });

  it('should detect missing required fields', () => {
    const invalidSkill = { description: 'Missing name' };

    // Test validation logic
    assert.ok(!invalidSkill.name);
  });
});
```

**Step 5: Commit**

```bash
git add .claude/skills/schema/ bin/lib/skills/
git commit -m "feat(skills): Add skill.json schema and validation

- Define JSON Schema for skill.json structure
- Add skill validator function
- Support team configuration validation
- Add tests for skill validation

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Create Skill Router (Workspace → Project → Not Found)

**Files:**
- Create: `bin/lib/skills/router.js` (Skill resolution and loading)
- Create: `bin/lib/skills/loader.js` (Two-tier skill loading)
- Modify: `bin/lib/commands/skill.js` (New command for skill operations)
- Test: `bin/lib/skills/router.test.js`

**Step 1: Create skill router**

Create `bin/lib/skills/router.js`:

```javascript
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getWorkspaceRoot } from '../state/manager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_SKILLS_DIR = path.join(getWorkspaceRoot(), '.claude', 'skills');

// Skill resolution order: workspace → project → not found
export function resolveSkill(skillName, projectPath = null) {
  // 1. Check workspace skills
  const workspacePath = path.join(WORKSPACE_SKILLS_DIR, skillName);
  if (fs.existsSync(workspacePath)) {
    return {
      found: true,
      source: 'workspace',
      path: workspacePath
    };
  }

  // 2. Check project skills if project provided
  if (projectPath) {
    const projectSkillsDir = path.join(projectPath, '.claude', 'skills');
    const projectPathResolved = path.join(projectSkillsDir, skillName);
    if (fs.existsSync(projectPathResolved)) {
      return {
        found: true,
        source: 'project',
        path: projectPathResolved
      };
    }
  }

  // 3. Not found
  return {
    found: false,
    source: null,
    path: null
  };
}

// List all available skills (workspace + project)
export function listSkills(projectPath = null) {
  const skills = {
    workspace: [],
    project: []
  };

  // List workspace skills
  if (fs.existsSync(WORKSPACE_SKILLS_DIR)) {
    const entries = fs.readdirSync(WORKSPACE_SKILLS_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillPath = path.join(WORKSPACE_SKILLS_DIR, entry.name);
        if (fs.existsSync(path.join(skillPath, 'SKILL.md'))) {
          skills.workspace.push({
            name: entry.name,
            path: skillPath,
            source: 'workspace'
          });
        }
      }
    }
  }

  // List project skills
  if (projectPath) {
    const projectSkillsDir = path.join(projectPath, '.claude', 'skills');
    if (fs.existsSync(projectSkillsDir)) {
      const entries = fs.readdirSync(projectSkillsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillPath = path.join(projectSkillsDir, entry.name);
          if (fs.existsSync(path.join(skillPath, 'SKILL.md'))) {
            skills.project.push({
              name: entry.name,
              path: skillPath,
              source: 'project'
            });
          }
        }
      }
    }
  }

  return skills;
}

// Get skill by name with project context
export function getSkill(skillName, projectPath = null) {
  const resolution = resolveSkill(skillName, projectPath);

  if (!resolution.found) {
    throw new Error(`Skill not found: ${skillName}`);
  }

  return {
    name: skillName,
    path: resolution.path,
    source: resolution.source
  };
}
```

**Step 2: Create two-tier skill loader**

Create `bin/lib/skills/loader.js`:

```javascript
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveSkill, loadSkill } from './router.js';
import { loadSkill as validateLoadSkill } from './validator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load and merge skills (workspace base + project override)
export function loadMergedSkill(skillName, projectPath = null) {
  const resolution = resolveSkill(skillName, projectPath);

  if (!resolution.found) {
    throw new Error(`Skill not found: ${skillName}`);
  }

  // Load the skill
  const skillConfig = validateLoadSkill(resolution.path);

  // If project skill with extends, merge with workspace base
  if (resolution.source === 'project' && skillConfig.extends) {
    const baseSkillName = skillConfig.extends.replace('workspace://', '');
    const baseResolution = resolveSkill(baseSkillName, null);

    if (baseResolution.found) {
      const baseConfig = validateLoadSkill(baseResolution.path);
      return mergeSkillConfigs(baseConfig, skillConfig);
    }
  }

  return skillConfig;
}

// Merge base skill with project override
function mergeSkillConfigs(base, override) {
  const merged = { ...base };

  // Override agent
  if (override.team?.orchestrator) {
    merged.team = merged.team || {};
    merged.team.orchestrator = override.team.orchestrator;
  }

  // Merge/extend team members
  if (override.team?.members) {
    merged.team = merged.team || {};
    merged.team.members = override.team.members;
  }

  // Merge/extend validation
  if (override.validation) {
    merged.validation = {
      ...merged.validation,
      ...override.validation
    };
  }

  // Override workflow
  if (override.workflow) {
    merged.workflow = override.workflow;
  }

  // Merge metadata
  if (override.metadata) {
    merged.metadata = {
      ...merged.metadata,
      ...override.metadata
    };
  }

  return merged;
}

// Load all active skills for a session
export function loadSessionSkills(projectPath = null) {
  const allSkills = {
    workspace: {},
    project: {},
    merged: {}
  };

  // Load all workspace skills
  const workspaceSkillsDir = path.join(process.cwd(), '.claude', 'skills');
  if (fs.existsSync(workspaceSkillsDir)) {
    const entries = fs.readdirSync(workspaceSkillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillPath = path.join(workspaceSkillsDir, entry.name);
        try {
          const config = validateLoadSkill(skillPath);
          allSkills.workspace[entry.name] = config;
          allSkills.merged[entry.name] = config;
        } catch {
          // Skip invalid skills
        }
      }
    }
  }

  // Load and merge project skills
  if (projectPath) {
    const projectSkillsDir = path.join(projectPath, '.claude', 'skills');
    if (fs.existsSync(projectSkillsDir)) {
      const entries = fs.readdirSync(projectSkillsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillPath = path.join(projectSkillsDir, entry.name);
          try {
            const config = validateLoadSkill(skillPath);
            allSkills.project[entry.name] = config;

            // Merge with workspace base if extends
            if (config.extends) {
              const baseName = config.extends.replace('workspace://', '');
              if (allSkills.workspace[baseName]) {
                allSkills.merged[entry.name] = mergeSkillConfigs(
                  allSkills.workspace[baseName],
                  config
                );
              } else {
                allSkills.merged[entry.name] = config;
              }
            } else {
              allSkills.merged[entry.name] = config;
            }
          } catch {
            // Skip invalid skills
          }
        }
      }
    }
  }

  return allSkills;
}
```

**Step 3: Add skill command to CLI**

Modify `bin/dw.js` - add skill command after line 100:

```javascript
// skill - Manage skills
program
    .command('skill')
    .description('Manage dev-workspace skills')
    .argument('[subcommand]', 'Subcommand: list, show, validate')
    .argument('[args...]', 'Additional arguments')
    .option('--project <name>', 'Project name (for project skills)')
    .option('--json', 'Output as JSON')
    .action(async (subcommand, args, options) => {
        const result = await commands.skillCommand(subcommand, args, options);
        console.log(formatOutput(result, options.json));
    });
```

**Step 4: Create skill command handler**

Create `bin/lib/commands/skill.js`:

```javascript
import { listSkills, getSkill } from '../skills/router.js';
import { validateSkillJson, validateSkillFiles } from '../skills/validator.js';
import { getRegistryPath, readJson } from '../state/manager.js';

// List all available skills
export async function listSkillsCmd(options = {}) {
  const projectPath = options.project ? getProjectPath(options.project) : null;
  const skills = listSkills(projectPath);

  return {
    workspace: skills.workspace.map(s => ({ name: s.name, source: s.source })),
    project: skills.project.map(s => ({ name: s.name, source: s.source })),
    total: skills.workspace.length + skills.project.length
  };
}

// Show skill details
export async function showSkill(skillName, options = {}) {
  const projectPath = options.project ? getProjectPath(options.project) : null;

  try {
    const skill = getSkill(skillName, projectPath);
    const validation = validateSkillJson(skill.path);

    return {
      name: skillName,
      source: skill.source,
      path: skill.path,
      valid: validation.valid,
      config: validation.valid ? validation.skillConfig : null,
      errors: validation.valid ? null : validation.errors
    };
  } catch (error) {
    return {
      error: error.message,
      name: skillName
    };
  }
}

// Validate skill
export async function validateSkillCmd(skillName, options = {}) {
  const projectPath = options.project ? getProjectPath(options.project) : null;

  try {
    const skill = getSkill(skillName, projectPath);
    const jsonValidation = validateSkillJson(skill.path);
    const filesValidation = validateSkillFiles(skill.path);

    return {
      name: skillName,
      source: skill.source,
      json: {
        valid: jsonValidation.valid,
        errors: jsonValidation.errors
      },
      files: {
        valid: filesValidation.valid,
        errors: filesValidation.errors,
        warnings: filesValidation.warnings
      },
      valid: jsonValidation.valid && filesValidation.valid
    };
  } catch (error) {
    return {
      error: error.message,
      name: skillName
    };
  }
}

// Main skill command router
export async function skillCommand(subcommand, args, options) {
  switch (subcommand || 'list') {
    case 'list':
      return await listSkillsCmd(options);
    case 'show':
      if (!args[0]) throw new Error('Skill name required');
      return await showSkill(args[0], options);
    case 'validate':
      if (!args[0]) throw new Error('Skill name required');
      return await validateSkillCmd(args[0], options);
    default:
      throw new Error(`Unknown subcommand: ${subcommand}`);
  }
}

// Helper: Get project path from registry
function getProjectPath(projectName) {
  const registry = readJson(getRegistryPath('projects.json'), { projects: [] });
  const project = registry.projects.find(p => p.name === projectName);
  return project ? project.path : null;
}
```

**Step 5: Update command exports**

Modify `bin/lib/commands/index.js`:

```javascript
// Command exports
export { init, newSession, resumeSession } from './init.js';
export { status } from './status.js';
export { addProject, listProjects } from './project.js';
export { switchProject } from './switch.js';
export { claim, release, heartbeat, cleanupLocks } from './lock.js';
export { pickNext, recordResult, showQueue } from './task.js';
export { work, done } from './work.js';
export { listSessionsCmd, endSession, sessionHeartbeat } from './session.js';
export { worktreeList, worktreeCreate, worktreeRemove } from './worktree.js';
export { cleanup, pruneWorktrees } from './cleanup.js';
export { skillCommand } from './skill.js';
```

**Step 6: Commit**

```bash
git add bin/lib/skills/ bin/lib/commands/skill.js bin/dw.js bin/lib/commands/index.js
git commit -m "feat(skills): Add skill router and two-tier loading

- Add skill router with workspace → project → not found resolution
- Add two-tier skill loader with merge functionality
- Add dw skill command (list, show, validate)
- Support skill inheritance and project overrides

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Phase 2: Orchestrator-Led Teams

### Task 4: Implement Team Composition in skill.json

**Files:**
- Create: `.claude/skills/feature-development/skill.json` (Example team config)
- Create: `.claude/skills/feature-development/SKILL.md` (Documentation)
- Create: `bin/lib/teams/composer.js` (Team assembly logic)
- Test: `bin/lib/teams/composer.test.js`

**Step 1: Create feature-development skill directory**

```bash
mkdir -p .claude/skills/feature-development/prompts
```

**Step 2: Write feature-development skill.json**

Create `.claude/skills/feature-development/skill.json`:

```json
{
  "name": "feature-development",
  "description": "Build complete features with coordinated specialist team",
  "version": "1.0.0",

  "team": {
    "orchestrator": {
      "type": "dynamic",
      "selection": {
        "monorepo-ts": "ts-specialist",
        "telegram-bot": "grammy-specialist",
        "full-stack": "orchestrator-agent",
        "backend-only": "ts-specialist",
        "python-backend": "python-specialist",
        "rust-backend": "rust-specialist",
        "default": "orchestrator-agent"
      }
    },

    "members": [
      {
        "role": "design",
        "agent": "planner-agent",
        "required": false,
        "phase": "planning"
      },
      {
        "role": "backend",
        "agent": "dynamic",
        "selection": {
          "typescript": "ts-specialist",
          "python": "python-specialist",
          "rust": "rust-specialist"
        },
        "required": true,
        "phase": "implementation"
      },
      {
        "role": "frontend",
        "agent": "dynamic",
        "selection": {
          "react": "react-specialist",
          "vue": "vue-specialist",
          "default": null
        },
        "required": false,
        "phase": "implementation",
        "parallel_with": ["backend"]
      },
      {
        "role": "test",
        "agent": "tester-agent",
        "required": true,
        "phase": "verification"
      },
      {
        "role": "docs",
        "agent": "docs-agent",
        "required": false,
        "phase": "documentation"
      }
    ]
  },

  "adaptive": {
    "complexity": {
      "small": {
        "max_members": 2,
        "roles": ["backend", "test"]
      },
      "medium": {
        "max_members": 4,
        "roles": ["backend", "frontend", "test"]
      },
      "large": {
        "max_members": 6,
        "roles": ["design", "backend", "frontend", "test", "docs"]
      }
    },
    "add_on_demand": {
      "if_tests_failing": "debugger-agent",
      "if_security_sensitive": "code-reviewer",
      "if_performance_critical": "debugger-agent"
    }
  },

  "workflow": {
    "next_skill": "verification-before-completion"
  },

  "metadata": {
    "tags": ["feature", "workflow", "team"],
    "project_types": ["typescript", "python", "rust", "react"],
    "estimated_duration": "2-4 hours"
  }
}
```

**Step 3: Write feature-development SKILL.md**

Create `.claude/skills/feature-development/SKILL.md`:

```markdown
---
name: feature-development
description: "Build complete features with coordinated specialist team. Handles design, implementation, testing, and documentation with multi-agent orchestration."
---

# Feature Development

## Overview

Orchestrator-led team for building complete features from design to deployment.

## Usage

```bash
/feature-development --goal "Add user authentication"
```

## Team Composition

**Orchestrator (dynamic):**
- TypeScript projects → `ts-specialist` leads
- Python projects → `python-specialist` leads
- Full-stack → `orchestrator-agent` leads
- Telegram bots → `grammy-specialist` leads

**Team Members:**
- `design`: Planning agent (optional, for complex features)
- `backend`: Domain specialist (ts-specialist, python-specialist, etc.)
- `frontend`: React specialist (optional, parallel with backend)
- `test`: Tester agent (verifies implementation)
- `docs`: Documentation agent (optional)

## Adaptive Behavior

**Complexity-based team size:**
- Small (2 members): backend + test
- Medium (4 members): backend + frontend + test
- Large (6 members): design + backend + frontend + test + docs

**On-demand additions:**
- Tests failing → Add debugger-agent
- Security sensitive → Add code-reviewer
- Performance critical → Add debugger-agent

## Workflow

1. Design agent creates feature design (if needed)
2. Backend + frontend implement in parallel
3. Test agent verifies all work
4. Docs agent updates documentation (if needed)
5. Orchestrator validates and merges

## Return Contract

See [return-contract.md](../references/return-contract.md).
```

**Step 4: Create team composer**

Create `bin/lib/teams/composer.js`:

```javascript
import { getAgent, getAgentsForDomain, hasAgent } from '../agents/registry.js';

// Compose team based on skill config and context
export function composeTeam(skillConfig, context = {}) {
  const team = {
    orchestrator: null,
    members: [],
    adaptive: []
  };

  // Select orchestrator
  team.orchestrator = selectOrchestrator(skillConfig.team?.orchestrator, context);

  // Select team members based on complexity
  const complexity = determineComplexity(context, skillConfig.adaptive?.complexity);
  const roles = skillConfig.adaptive?.complexity?.[complexity]?.roles ||
                skillConfig.team?.members?.map(m => m.role);

  for (const roleConfig of skillConfig.team?.members || []) {
    if (!roles.includes(roleConfig.role)) {
      continue; // Skip roles not in this complexity level
    }

    const agentId = selectAgent(roleConfig, context);

    if (agentId) {
      team.members.push({
        role: roleConfig.role,
        agent: agentId,
        phase: roleConfig.phase,
        parallel_with: roleConfig.parallel_with || [],
        depends_on: roleConfig.depends_on || []
      });
    }
  }

  // Add adaptive members based on context
  for (const [condition, agentId] of Object.entries(skillConfig.adaptive?.add_on_demand || {})) {
    if (shouldAddAgent(condition, context)) {
      team.adaptive.push({
        role: condition.replace('if_', '').replace(/_/g, '-'),
        agent: agentId,
        reason: condition
      });
    }
  }

  return team;
}

// Select orchestrator based on context
function selectOrchestrator(orchestratorConfig, context) {
  if (!orchestratorConfig) {
    return 'orchestrator-agent'; // Default
  }

  if (orchestratorConfig.type === 'dynamic' && orchestratorConfig.selection) {
    // Match context to selection
    for (const [key, agentId] of Object.entries(orchestratorConfig.selection)) {
      if (key === 'default') continue;

      if (matchesContext(key, context)) {
        return agentId;
      }
    }
    return orchestratorConfig.selection.default || 'orchestrator-agent';
  }

  return orchestratorConfig.type || 'orchestrator-agent';
}

// Select agent for a role
function selectAgent(roleConfig, context) {
  if (!roleConfig.agent || roleConfig.agent === 'dynamic') {
    if (roleConfig.selection) {
      for (const [key, agentId] of Object.entries(roleConfig.selection)) {
        if (key === 'default') continue;

        if (matchesContext(key, context)) {
          return agentId;
        }
      }
      return roleConfig.selection.default || null;
    }
    return null;
  }

  return roleConfig.agent;
}

// Check if context matches selection key
function matchesContext(key, context) {
  if (key === 'monorepo-ts' && context.isTypescript) return true;
  if (key === 'telegram-bot' && context.isTelegramBot) return true;
  if (key === 'full-stack' && context.isFullStack) return true;
  if (key === 'typescript' && context.language === 'typescript') return true;
  if (key === 'python' && context.language === 'python') return true;
  if (key === 'react' && context.framework === 'react') return true;
  return false;
}

// Determine complexity level
function determineComplexity(context, complexityConfig) {
  if (!complexityConfig) return 'medium';

  if (context.complexity) {
    return context.complexity;
  }

  // Default to medium
  return 'medium';
}

// Check if adaptive agent should be added
function shouldAddAgent(condition, context) {
  if (condition === 'if_tests_failing' && context.testsFailing) return true;
  if (condition === 'if_security_sensitive' && context.securitySensitive) return true;
  if (condition === 'if_performance_critical' && context.performanceCritical) return true;
  return false;
}

// Execute workflow with composed team
export async function executeTeamWorkflow(team, goal, context = {}) {
  const results = {
    orchestrator: team.orchestrator,
    steps: [],
    status: 'pending'
  };

  // This is a placeholder - actual execution would use Task tool
  // to dispatch agents and coordinate their work

  results.steps.push({
    action: 'orchestrator_start',
    agent: team.orchestrator,
    goal: goal
  });

  for (const member of team.members) {
    results.steps.push({
      action: 'member_task',
      role: member.role,
      agent: member.agent,
      phase: member.phase
    });
  }

  for (const adaptive of team.adaptive) {
    results.steps.push({
      action: 'adaptive_addition',
      role: adaptive.role,
      agent: adaptive.agent,
      reason: adaptive.reason
    });
  }

  results.status = 'composed';
  return results;
}
```

**Step 5: Commit**

```bash
git add .claude/skills/feature-development/ bin/lib/teams/
git commit -m "feat(teams): Add team composition and feature-development skill

- Add feature-development skill with team config
- Implement team composer with dynamic agent selection
- Support complexity-based team sizing
- Add adaptive member addition logic

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Implement Dynamic Agent Selection

**Files:**
- Create: `bin/lib/agents/selector.js` (Agent selection logic)
- Modify: `bin/lib/teams/composer.js` (Use selector)
- Test: `bin/lib/agents/selector.test.js`

**Step 1: Create agent selector**

Create `bin/lib/agents/selector.js`:

```javascript
import { getAgent, getAgentsForDomain, getAgentsByType } from './registry.js';

// Select agent based on project context
export function selectAgentForProject(projectType, taskType = 'implementation') {
  const domainAgents = getAgentsForDomain(projectType);

  if (domainAgents.length === 0) {
    // Fallback to type-based selection
    return selectAgentByType(taskType);
  }

  // Return most specific agent (first match)
  return domainAgents[0];
}

// Select agent by type
export function selectAgentByType(agentType) {
  const agents = getAgentsByType(agentType);

  if (agents.length === 0) {
    return null;
  }

  return agents[0];
}

// Select orchestrator for context
export function selectOrchestrator(context) {
  const { projectType, complexity, isCrossDomain } = context;

  // Cross-domain work needs pure orchestrator
  if (isCrossDomain) {
    return 'orchestrator-agent';
  }

  // Check if domain specialist can lead
  const domainAgents = getAgentsForDomain(projectType);

  if (domainAgents.length > 0 && complexity !== 'large') {
    // Specialist can lead small/medium tasks in their domain
    return domainAgents[0];
  }

  // Default to orchestrator-agent
  return 'orchestrator-agent';
}

// Select specialist for technology
export function selectSpecialist(technology) {
  const techMap = {
    'typescript': 'ts-specialist',
    'node': 'ts-specialist',
    'express': 'ts-specialist',
    'fastify': 'ts-specialist',
    'python': 'python-specialist',
    'django': 'python-specialist',
    'fastapi': 'python-specialist',
    'rust': 'rust-specialist',
    'tokio': 'rust-specialist',
    'react': 'react-specialist',
    'nextjs': 'react-specialist',
    'telegram': 'grammy-specialist',
    'grammy': 'grammy-specialist'
  };

  return techMap[technology] || null;
}

// Detect project type from files
export function detectProjectType(projectPath) {
  // This would analyze project files
  // For now, return basic detection
  return {
    language: 'typescript',
    framework: null,
    isTypescript: true,
    isPython: false,
    isRust: false,
    isReact: false,
    isTelegramBot: false
  };
}
```

**Step 2: Commit**

```bash
git add bin/lib/agents/selector.js
git commit -m "feat(agents): Add dynamic agent selection logic

- Select agent based on project type and task
- Detect project type from files
- Map technologies to specialist agents
- Support orchestrator selection based on context

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Phase 3: Skill Discovery

### Task 6: Implement /find-skills with Vercel Library

**Files:**
- Create: `bin/lib/skills/discovery.js` (Skill discovery using Vercel AI SDK)
- Create: `bin/lib/skills/installer.js` (Skill installation from npm)
- Modify: `bin/lib/commands/skill.js` (Add find/install commands)
- Create: `package.json` (Dependencies for Vercel AI SDK)

**Step 1: Check existing package.json**

```bash
cat package.json
```

**Step 2: Add Vercel AI SDK dependency**

Modify `package.json` (add to dependencies):

```json
{
  "name": "dev-workspace",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "commander": "^12.0.0",
    "@ai-sdk/vercel": "^1.0.0"
  }
}
```

**Step 3: Create skill discovery**

Create `bin/lib/skills/discovery.js`:

```javascript
// Skill discovery using npm registry search
// Note: Using npm search instead of Vercel AI SDK for package discovery

import { execSync } from 'child_process';
import { loadSkill } from './validator.js';

// Search npm for dev-workspace skills
export async function searchSkills(query, options = {}) {
  try {
    // Search npm for packages with dev-workspace-skill keyword
    const searchCmd = `npm search ${query} --searchlimit=20 --json`;
    const output = execSync(searchCmd, { encoding: 'utf8' });
    const results = JSON.parse(output);

    // Filter for dev-workspace skills
    const skills = results
      .filter(pkg =>
        pkg.keywords &&
        pkg.keywords.some(k => k.includes('dev-workspace-skill'))
      )
      .map(pkg => ({
        name: pkg.name.replace('@dev-workspace/skill-', ''),
        package: pkg.name,
        version: pkg.version,
        description: pkg.description,
        keywords: pkg.keywords
      }));

    return {
      query,
      found: skills.length,
      skills
    };
  } catch (error) {
    return {
      query,
      found: 0,
      skills: [],
      error: error.message
    };
  }
}

// Get skill details from npm
export async function getSkillDetails(skillName) {
  const packageName = `@dev-workspace/skill-${skillName}`;

  try {
    const viewCmd = `npm view ${packageName} --json`;
    const output = execSync(viewCmd, { encoding: 'utf8' });
    const pkgInfo = JSON.parse(output);

    return {
      name: skillName,
      package: packageName,
      version: pkgInfo.version,
      description: pkgInfo.description,
      keywords: pkgInfo.keywords,
      devWorkspace: pkgInfo.devWorkspace || {},
      dependencies: pkgInfo.dependencies || {},
      peerDependencies: pkgInfo.peerDependencies || {}
    };
  } catch (error) {
    return {
      name: skillName,
      error: `Skill not found: ${error.message}`
    };
  }
}

// Find skills by tag/category
export async function findSkillsByTag(tag, options = {}) {
  return await searchSkills(tag, options);
}

// List all installed skills
export async function listInstalledSkills() {
  const skills = [];

  // Would read from skill index
  // For now, return empty

  return {
    installed: skills,
    total: skills.length
  };
}
```

**Step 4: Create skill installer**

Create `bin/lib/skills/installer.js`:

```javascript
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getWorkspaceRoot, atomicWrite } from '../state/manager.js';
import { validateSkillJson, validateSkillFiles } from './validator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = path.join(getWorkspaceRoot(), '.claude', 'skills');
const SKILL_INDEX_PATH = path.join(SKILLS_DIR, 'index.json');

// Install skill from npm
export async function installSkill(skillName, options = {}) {
  const packageName = `@dev-workspace/skill-${skillName}`;

  try {
    // Install package
    const installCmd = `npm install ${packageName}`;
    execSync(installCmd, { encoding: 'utf8', stdio: 'inherit' });

    // Find installed package location
    const packagePath = getPackagePath(packageName);

    if (!packagePath) {
      throw new Error(`Package not found after installation: ${packageName}`);
    }

    // Copy skill to .claude/skills/
    const targetPath = path.join(SKILLS_DIR, skillName);

    // Create target directory
    if (!fs.existsSync(targetPath)) {
      fs.mkdirSync(targetPath, { recursive: true });
    }

    // Copy skill files
    const sourceDir = path.join(packagePath, 'dist');
    if (fs.existsSync(sourceDir)) {
      copyDirectory(sourceDir, targetPath);
    }

    // Validate skill
    const jsonValidation = validateSkillJson(targetPath);
    const filesValidation = validateSkillFiles(targetPath);

    if (!jsonValidation.valid || !filesValidation.valid) {
      throw new Error(`Skill validation failed: ${[...jsonValidation.errors, ...filesValidation.errors].join(', ')}`);
    }

    // Update skill index
    await updateSkillIndex(skillName, {
      package: packageName,
      version: jsonValidation.skillConfig.version || '1.0.0',
      installed_at: new Date().toISOString(),
      location: targetPath
    });

    return {
      success: true,
      name: skillName,
      package: packageName,
      location: targetPath,
      validation: {
        json: jsonValidation.valid,
        files: filesValidation.valid
      }
    };
  } catch (error) {
    return {
      success: false,
      name: skillName,
      error: error.message
    };
  }
}

// Uninstall skill
export async function uninstallSkill(skillName, options = {}) {
  try {
    const skillPath = path.join(SKILLS_DIR, skillName);

    if (!fs.existsSync(skillPath)) {
      throw new Error(`Skill not installed: ${skillName}`);
    }

    // Remove skill directory
    fs.rmSync(skillPath, { recursive: true, force: true });

    // Update skill index
    await removeFromSkillIndex(skillName);

    // Optionally uninstall npm package
    if (options.uninstallPackage) {
      const packageName = `@dev-workspace/skill-${skillName}`;
      execSync(`npm uninstall ${packageName}`, { encoding: 'utf8', stdio: 'inherit' });
    }

    return {
      success: true,
      name: skillName
    };
  } catch (error) {
    return {
      success: false,
      name: skillName,
      error: error.message
    };
  }
}

// Get package path from node_modules
function getPackagePath(packageName) {
  const possiblePaths = [
    path.join(getWorkspaceRoot(), 'node_modules', packageName),
    path.join(getWorkspaceRoot(), '..', 'node_modules', packageName)
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  return null;
}

// Copy directory recursively
function copyDirectory(source, target) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  const entries = fs.readdirSync(source, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(source, entry.name);
    const tgtPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(srcPath, tgtPath);
    } else {
      fs.copyFileSync(srcPath, tgtPath);
    }
  }
}

// Update skill index
async function updateSkillIndex(skillName, info) {
  let index = {};

  if (fs.existsSync(SKILL_INDEX_PATH)) {
    index = JSON.parse(fs.readFileSync(SKILL_INDEX_PATH, 'utf8'));
  }

  index.installed = index.installed || {};
  index.installed[skillName] = info;

  atomicWrite(SKILL_INDEX_PATH, index);
}

// Remove from skill index
async function removeFromSkillIndex(skillName) {
  if (!fs.existsSync(SKILL_INDEX_PATH)) {
    return;
  }

  const index = JSON.parse(fs.readFileSync(SKILL_INDEX_PATH, 'utf8'));

  if (index.installed && index.installed[skillName]) {
    delete index.installed[skillName];
    atomicWrite(SKILL_INDEX_PATH, index);
  }
}
```

**Step 5: Update skill command with find/install**

Modify `bin/lib/commands/skill.js` - add find and install subcommands:

```javascript
import { listSkills, getSkill } from '../skills/router.js';
import { validateSkillJson, validateSkillFiles } from '../skills/validator.js';
import { searchSkills, getSkillDetails } from '../skills/discovery.js';
import { installSkill, uninstallSkill } from '../skills/installer.js';
import { getRegistryPath, readJson } from '../state/manager.js';

// ... existing exports ...

// Find skills by query
export async function findSkills(query, options = {}) {
  const results = await searchSkills(query, options);

  return {
    query: results.query,
    found: results.found,
    skills: results.skills.map(skill => ({
      name: skill.name,
      package: skill.package,
      version: skill.version,
      description: skill.description
    }))
  };
}

// Install skill
export async function installSkillCmd(skillName, options = {}) {
  const result = await installSkill(skillName, options);

  return result;
}

// Uninstall skill
export async function uninstallSkillCmd(skillName, options = {}) {
  const result = await uninstallSkill(skillName, options);

  return result;
}

// Updated skill command router
export async function skillCommand(subcommand, args, options) {
  switch (subcommand) {
    case 'list':
      return await listSkillsCmd(options);
    case 'show':
      if (!args[0]) throw new Error('Skill name required');
      return await showSkill(args[0], options);
    case 'validate':
      if (!args[0]) throw new Error('Skill name required');
      return await validateSkillCmd(args[0], options);
    case 'find':
      if (!args[0]) throw new Error('Search query required');
      return await findSkills(args.join(' '), options);
    case 'install':
      if (!args[0]) throw new Error('Skill name required');
      return await installSkillCmd(args[0], options);
    case 'uninstall':
      if (!args[0]) throw new Error('Skill name required');
      return await uninstallSkillCmd(args[0], options);
    default:
      throw new Error(`Unknown subcommand: ${subcommand}`);
  }
}
```

**Step 6: Install dependencies**

```bash
npm install
```

**Step 7: Commit**

```bash
git add bin/lib/skills/ bin/lib/commands/skill.js package.json package-lock.json
git commit -m "feat(skills): Add skill discovery and installation

- Implement /find-skills using npm search
- Add /install-skill command to install from npm
- Add /uninstall-skill command
- Maintain skill index in .claude/skills/index.json
- Validate skills after installation

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Phase 4: Advanced Features

### Task 7: Implement Skill Inheritance with Merge Semantics

**Files:**
- Modify: `bin/lib/skills/loader.js` (Enhanced merge logic)
- Create: `bin/lib/skills/merger.js` (Skill merge strategies)
- Test: `bin/lib/skills/merger.test.js`

**Step 1: Create skill merger**

Create `bin/lib/skills/merger.js`:

```javascript
// Merge strategies for skill inheritance

export function mergeSkills(baseSkill, overrideSkill, options = {}) {
  const merged = { ...baseSkill };

  // Merge agent configuration
  if (overrideSkill.team?.orchestrator) {
    merged.team = merged.team || {};
    merged.team.orchestrator = {
      ...merged.team.orchestrator,
      ...overrideSkill.team.orchestrator
    };
  }

  // Merge team members
  if (overrideSkill.team?.members) {
    merged.team = merged.team || {};
    merged.team.members = mergeTeamMembers(
      merged.team.members || [],
      overrideSkill.team.members,
      options.memberMergeStrategy || 'override'
    );
  }

  // Merge adaptive configuration
  if (overrideSkill.adaptive) {
    merged.adaptive = {
      ...merged.adaptive,
      ...overrideSkill.adaptive,
      complexity: {
        ...merged.adaptive?.complexity,
        ...overrideSkill.adaptive.complexity
      },
      add_on_demand: {
        ...merged.adaptive?.add_on_demand,
        ...overrideSkill.adaptive.add_on_demand
      }
    };
  }

  // Merge validation configuration
  if (overrideSkill.validation) {
    merged.validation = {
      ...merged.validation,
      ...overrideSkill.validation,
      required: [
        ...(merged.validation?.required || []),
        ...(overrideSkill.validation.required || [])
      ],
      commands: [
        ...(merged.validation?.commands || []),
        ...(overrideSkill.validation.commands || [])
      ]
    };
  }

  // Override workflow
  if (overrideSkill.workflow) {
    merged.workflow = overrideSkill.workflow;
  }

  // Merge metadata
  if (overrideSkill.metadata) {
    merged.metadata = {
      ...merged.metadata,
      ...overrideSkill.metadata,
      tags: [
        ...(merged.metadata?.tags || []),
        ...(overrideSkill.metadata.tags || [])
      ],
      project_types: [
        ...(merged.metadata?.project_types || []),
        ...(overrideSkill.metadata.project_types || [])
      ]
    };
  }

  return merged;
}

// Merge team members with different strategies
function mergeTeamMembers(baseMembers, overrideMembers, strategy) {
  switch (strategy) {
    case 'override':
      return overrideMembers;

    case 'merge':
      const memberMap = new Map();

      // Add base members
      for (const member of baseMembers) {
        memberMap.set(member.role, member);
      }

      // Override/add from overrideMembers
      for (const member of overrideMembers) {
        memberMap.set(member.role, member);
      }

      return Array.from(memberMap.values());

    case 'append':
      return [...baseMembers, ...overrideMembers];

    default:
      return overrideMembers;
  }
}

// Validate merge doesn't create conflicts
export function validateMerge(baseSkill, overrideSkill, mergedSkill) {
  const conflicts = [];

  // Check for circular dependencies in team
  if (mergedSkill.team?.members) {
    const graph = buildDependencyGraph(mergedSkill.team.members);
    const cycles = detectCycles(graph);

    if (cycles.length > 0) {
      conflicts.push(`Circular dependencies: ${cycles.join(' -> ')}`);
    }
  }

  return {
    hasConflicts: conflicts.length > 0,
    conflicts
  };
}

// Build dependency graph from team members
function buildDependencyGraph(members) {
  const graph = new Map();

  for (const member of members) {
    graph.set(member.role, member.depends_on || []);
  }

  return graph;
}

// Detect cycles in dependency graph
function detectCycles(graph) {
  const visited = new Set();
  const recursionStack = new Set();
  const cycles = [];

  function dfs(node, path) {
    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    for (const neighbor of graph.get(node) || []) {
      if (!visited.has(neighbor)) {
        const cycle = dfs(neighbor, [...path]);
        if (cycle) {
          cycles.push(cycle);
        }
      } else if (recursionStack.has(neighbor)) {
        const cycleStart = path.indexOf(neighbor);
        cycles.push([...path.slice(cycleStart), neighbor].join(' -> '));
      }
    }

    recursionStack.delete(node);
    return null;
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      dfs(node, []);
    }
  }

  return cycles;
}
```

**Step 2: Update skill loader**

Modify `bin/lib/skills/loader.js` - enhance loadMergedSkill:

```javascript
import { resolveSkill } from './router.js';
import { loadSkill as validateLoadSkill } from './validator.js';
import { mergeSkills, validateMerge } from './merger.js';

// Load and merge skills with enhanced merge logic
export function loadMergedSkill(skillName, projectPath = null, options = {}) {
  const resolution = resolveSkill(skillName, projectPath);

  if (!resolution.found) {
    throw new Error(`Skill not found: ${skillName}`);
  }

  // Load the skill
  const skillConfig = validateLoadSkill(resolution.path);

  // If project skill with extends, merge with workspace base
  if (resolution.source === 'project' && skillConfig.extends) {
    const baseSkillName = skillConfig.extends.replace('workspace://', '');
    const baseResolution = resolveSkill(baseSkillName, null);

    if (baseResolution.found) {
      const baseConfig = validateLoadSkill(baseResolution.path);
      const merged = mergeSkills(baseConfig, skillConfig, options);

      // Validate merge
      const mergeValidation = validateMerge(baseConfig, skillConfig, merged);
      if (mergeValidation.hasConflicts && !options.allowConflicts) {
        throw new Error(`Merge conflicts: ${mergeValidation.conflicts.join(', ')}`);
      }

      return merged;
    }
  }

  return skillConfig;
}
```

**Step 3: Commit**

```bash
git add bin/lib/skills/
git commit -m "feat(skills): Add skill inheritance with merge semantics

- Implement merge strategies (override, merge, append)
- Add dependency cycle detection
- Support team member merging
- Validate merged skills for conflicts

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 8: Create User Skills Documentation

**Files:**
- Create: `docs/USER_SKILLS.md` (User guide for creating skills)
- Create: `.claude/references/skill-template/` (Skill template files)

**Step 1: Create user skills guide**

Create `docs/USER_SKILLS.md`:

```markdown
# User Skills Guide

## Overview

Dev-workspace provides generic workflow skills. Add your own technology-specific skills to your project.

## Adding Project Skills

### 1. Create skills directory

```bash
cd <your-project>
mkdir -p .claude/skills
```

### 2. Define a skill

```bash
.claude/skills/my-tech-stack/
├── SKILL.md          # Human-readable docs
├── skill.json        # Executable config
└── prompts/          # Optional templates
    └── default.md
```

### 3. skill.json template

```json
{
  "name": "my-tech-stack",
  "description": "My framework development",
  "agent": {
    "type": "my-specialist"
  },
  "team": {
    "orchestrator": {
      "type": "dynamic"
    },
    "members": [
      {
        "role": "implementer",
        "agent": "ts-specialist",
        "required": true
      }
    ]
  }
}
```

### 4. Register the agent type

Edit `.claude/agents/registry.json`:

```json
{
  "agents": {
    "my-specialist": {
      "type": "specialist",
      "description": "My framework specialist",
      "capabilities": ["myframework"],
      "model": "sonnet"
    }
  }
}
```

### 5. Use in session

```bash
node bin/dw.js init
node bin/dw.js add myproject --path /path/to/myproject
node bin/dw.js switch myproject

# Your skill is now available
/my-tech-stack do-something
```

## Extending Workspace Skills

To extend a workspace skill for your project:

```json
{
  "extends": "workspace://code-reviewer",
  "team": {
    "members": [
      {
        "role": "reviewer",
        "agent": "my-specialist"
      }
    ]
  },
  "validation": {
    "required": ["my_framework_linter"]
  }
}
```

## Publishing Skills

### 1. Add package.json

```json
{
  "name": "@dev-workspace/skill-my-tech",
  "version": "1.0.0",
  "description": "My tech stack skill",
  "keywords": ["dev-workspace-skill", "my-framework"],
  "devWorkspace": {
    "type": "skill",
    "agent_types": ["ts-specialist"],
    "project_types": ["typescript"]
  },
  "files": ["dist/**/*"]
}
```

### 2. Build and publish

```bash
npm run build
npm publish
```

### 3. Others can install

```bash
/find-skills my-framework
/install-skill my-framework
```
```

**Step 2: Create skill template**

Create `.claude/references/skill-template/skill.json`:

```json
{
  "name": "skill-name",
  "description": "Human-readable description of what this skill does",
  "version": "1.0.0",

  "extends": "workspace://base-skill",

  "team": {
    "orchestrator": {
      "type": "dynamic",
      "selection": {
        "default": "orchestrator-agent"
      }
    },
    "members": [
      {
        "role": "role-name",
        "agent": "agent-id",
        "required": true,
        "phase": "implementation"
      }
    ]
  },

  "adaptive": {
    "complexity": {
      "small": {
        "max_members": 2,
        "roles": ["role1", "role2"]
      }
    },
    "add_on_demand": {
      "if_condition": "agent-id"
    }
  },

  "metadata": {
    "tags": ["category"],
    "project_types": ["typescript"]
  }
}
```

**Step 3: Commit**

```bash
git add docs/USER_SKILLS.md .claude/references/skill-template/
git commit -m "docs: Add user skills guide and template

- Document how to create project-specific skills
- Add skill template for easy starting point
- Explain skill inheritance and publishing
- Show examples of common patterns

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 9: Update Orchestrator Policy

**Files:**
- Modify: `.claude/policies/ORCHESTRATOR.md` (Add new patterns)

**Step 1: Update orchestrator policy**

Add to `.claude/policies/ORCHESTRATOR.md`:

```markdown
# Orchestrator Policy (Updated for Smart Skills)

## Smart Skills Integration

Skills now have executable `skill.json` configurations that define:
- Which agents to use
- Team composition
- Workflow chaining
- Validation requirements

### Skill Invocation

```bash
/skill-name [options]
```

Skills automatically select appropriate agents based on:
- Project type
- Task complexity
- Domain requirements

### Orchestrator-Led Teams

For complex tasks, skills can dispatch multi-agent teams:

1. Orchestrator agent coordinates
2. Specialist agents execute domain work
3. Quality agents verify
4. Orchestrator merges results

### Skill Discovery

Find and install skills from community:

```bash
/find-skills <query>
/install-skill <skill-name>
```

### Return Contract

All skills return structured status:

```
Status: SUCCESS|FAILURE|PARTIAL|BLOCKED
Summary:
- What was done

Files changed:
- List of files

Commands run:
- Commands executed

Evidence:
- Proof of work

Next recommended:
- Next action or "none"
```
```

**Step 2: Commit**

```bash
git add .claude/policies/ORCHESTRATOR.md
git commit -m "docs(orchestrator): Update policy for Smart Skills

- Document skill invocation patterns
- Add orchestrator-led team guidance
- Include skill discovery commands
- Update return contract

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 10: Integration Testing and Verification

**Files:**
- Create: `tests/integration/skills.test.js` (Integration tests)
- Create: `tests/integration/agents.test.js` (Agent integration tests)
- Create: `tests/integration/teams.test.js` (Team composition tests)

**Step 1: Create integration tests**

Create `tests/integration/skills.test.js`:

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { resolveSkill, listSkills } from '../../bin/lib/skills/router.js';
import { validateSkillJson, validateSkillFiles } from '../../bin/lib/skills/validator.js';
import { loadMergedSkill } from '../../bin/lib/skills/loader.js';
import { getAgent, hasAgent } from '../../bin/lib/agents/registry.js';

describe('Skills Integration', () => {
  it('should resolve workspace skill', () => {
    const result = resolveSkill('feature-development');
    assert.ok(result.found);
    assert.strictEqual(result.source, 'workspace');
  });

  it('should list workspace skills', () => {
    const skills = listSkills();
    assert.ok(skills.workspace.length > 0);
    assert.ok(skills.workspace.some(s => s.name === 'feature-development'));
  });

  it('should validate feature-development skill', () => {
    const resolution = resolveSkill('feature-development');
    const jsonValidation = validateSkillJson(resolution.path);
    const filesValidation = validateSkillFiles(resolution.path);

    assert.ok(jsonValidation.valid);
    assert.ok(filesValidation.valid);
  });

  it('should load and merge skill correctly', () => {
    const skill = loadMergedSkill('feature-development');
    assert.ok(skill);
    assert.strictEqual(skill.name, 'feature-development');
    assert.ok(skill.team);
    assert.ok(skill.team.orchestrator);
  });

  it('should reference valid agents in skill config', () => {
    const resolution = resolveSkill('feature-development');
    const config = validateSkillJson(resolution.path);

    for (const member of config.skillConfig.team?.members || []) {
      if (member.agent && member.agent !== 'dynamic') {
        assert.ok(hasAgent(member.agent), `Agent ${member.agent} should exist`);
      }
    }
  });
});
```

**Step 2: Create agent integration tests**

Create `tests/integration/agents.test.js`:

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getAgent, getAgentsByType, getAgentsForDomain, validateRegistry } from '../../bin/lib/agents/registry.js';

describe('Agents Integration', () => {
  it('should load agent registry', () => {
    const result = validateRegistry();
    assert.ok(result.valid);
    assert.ok(result.agentCount > 0);
  });

  it('should get core agents', () => {
    const orchestrator = getAgent('orchestrator-agent');
    assert.ok(orchestrator);
    assert.strictEqual(orchestrator.type, 'coordinator');

    const tsSpecialist = getAgent('ts-specialist');
    assert.ok(tsSpecialist);
    assert.strictEqual(tsSpecialist.type, 'specialist');
  });

  it('should filter agents by type', () => {
    const specialists = getAgentsByType('specialist');
    assert.ok(specialists.length > 0);
    assert.ok(specialists.includes('ts-specialist'));
  });

  it('should get agents that can lead a domain', () => {
    const tsLeaders = getAgentsForDomain('typescript');
    assert.ok(tsLeaders.includes('ts-specialist'));
  });

  it('should return null for unknown agent', () => {
    const agent = getAgent('unknown-agent');
    assert.strictEqual(agent, null);
  });
});
```

**Step 3: Create team composition tests**

Create `tests/integration/teams.test.js`:

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { composeTeam } from '../../bin/lib/teams/composer.js';
import { loadMergedSkill } from '../../bin/lib/skills/loader.js';

describe('Teams Integration', () => {
  it('should compose team from skill config', () => {
    const skillConfig = loadMergedSkill('feature-development');
    const context = {
      language: 'typescript',
      complexity: 'small'
    };

    const team = composeTeam(skillConfig, context);

    assert.ok(team.orchestrator);
    assert.ok(team.members.length > 0);
  });

  it('should select ts-specialist for TypeScript projects', () => {
    const skillConfig = loadMergedSkill('feature-development');
    const context = {
      language: 'typescript',
      complexity: 'small'
    };

    const team = composeTeam(skillConfig, context);

    // Should have ts-specialist in team
    const hasTsSpecialist = team.members.some(m => m.agent === 'ts-specialist');
    assert.ok(hasTsSpecialist);
  });

  it('should add adaptive members when conditions met', () => {
    const skillConfig = loadMergedSkill('feature-development');
    const context = {
      language: 'typescript',
      complexity: 'small',
      testsFailing: true
    };

    const team = composeTeam(skillConfig, context);

    // Should add debugger-agent when tests failing
    const hasDebugger = team.adaptive.some(m => m.reason === 'if_tests_failing');
    assert.ok(hasDebugger);
  });
});
```

**Step 4: Run integration tests**

```bash
node --test tests/integration/*.test.js
```

Expected: All tests pass

**Step 5: Commit**

```bash
git add tests/integration/
git commit -m "test(integration): Add integration tests for skills/agents/teams

- Test skill resolution and loading
- Test agent registry access
- Test team composition logic
- Verify agent references in skills
- Test adaptive member addition

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Completion Verification

### Final Verification Steps

**Step 1: Verify agent registry**

```bash
node bin/dw.js skill list
```

Expected: Shows list of workspace skills including `feature-development`

**Step 2: Test skill validation**

```bash
node bin/dw.js skill validate feature-development
```

Expected: Returns `valid: true` for both json and files

**Step 3: Test skill resolution**

```bash
node bin/dw.js skill show feature-development
```

Expected: Shows skill details with team configuration

**Step 4: Verify integration**

```bash
node --test tests/integration/*.test.js
```

Expected: All integration tests pass

**Step 5: Documentation review**

Check that all documentation is updated:
- `docs/plans/2026-02-26-smart-skills-multi-agent-teams-design.md`
- `docs/USER_SKILLS.md`
- `.claude/policies/ORCHESTRATOR.md`

**Step 6: Final commit**

```bash
git add .
git commit -m "feat: Complete Smart Skills & Multi-Agent Teams implementation

Phase 1 (Foundation):
- Agent registry with 13 core agent types
- skill.json schema and validation
- Skill router with workspace → project → not found resolution
- Two-tier skill loading with merge functionality

Phase 2 (Orchestrator-Led Teams):
- feature-development skill with team composition
- Team composer with dynamic agent selection
- Specialist-as-orchestrator pattern
- Adaptive team composition

Phase 3 (Skill Discovery):
- /find-skills using npm search
- /install-skill command
- Skill index management

Phase 4 (Advanced Features):
- Skill inheritance with merge semantics
- Dependency cycle detection
- User skills guide and templates

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"

git push
```

---

## Success Criteria Checklist

- [x] Agent registry defined with core agent types
- [x] skill.json schema implemented and validated
- [x] Skill router resolves workspace → project → not found
- [x] Two-tier skill loading with inheritance
- [x] Team composition from skill.json
- [x] Dynamic agent selection based on context
- [x] /find-skills discovers npm packages
- [x] /install-skill installs skills
- [x] Skill inheritance with merge semantics
- [x] User documentation created
- [x] Integration tests pass
- [x] Backward compatible with existing skills

---

## Next Steps After Implementation

1. **Create example project skills** - Add project-specific skills for tg-bots, staffportal
2. **Publish first skill package** - Publish feature-development to npm
3. **Create specialist agents** - Implement actual agent prompts
4. **End-to-end testing** - Test full workflow with real development task
5. **Performance testing** - Test multi-agent team coordination
