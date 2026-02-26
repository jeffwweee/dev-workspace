/**
 * Skill Validator Module
 *
 * Validates skill.json files against the schema and checks:
 * - Required fields
 * - Agent references (must exist in registry)
 * - SKILL.md file existence
 * - Valid inheritance references
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { readJson, getWorkspaceRoot } from '../state/manager.js';
import { hasAgent } from '../agents/registry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Get the path to the skill schema file
 * @returns {string} Absolute path to skill.schema.json
 */
export function getSkillSchemaPath() {
    return path.join(getWorkspaceRoot(), '.claude', 'skills', 'schema', 'skill.schema.json');
}

/**
 * Load the skill schema
 * @returns {Object} The JSON schema object
 */
export function loadSkillSchema() {
    const schemaPath = getSkillSchemaPath();
    return readJson(schemaPath, {});
}

/**
 * Validate skill.json structure against schema
 * @param {string|Object} skillPathOrData - Path to skill.json or skill data object
 * @param {string} skillDir - Directory containing skill files (required if skillPathOrData is object)
 * @returns {Object} Validation result {valid: boolean, errors: string[], warnings: string[], skill: Object|null}
 */
export function validateSkillJson(skillPathOrData, skillDir = null) {
    const errors = [];
    const warnings = [];

    let skillData;
    let skillPath;
    let dirPath;

    // Handle both path string and data object
    if (typeof skillPathOrData === 'string') {
        skillPath = skillPathOrData;
        dirPath = path.dirname(skillPath);

        if (!fs.existsSync(skillPath)) {
            return {
                valid: false,
                errors: [`Skill file not found: ${skillPath}`],
                warnings: [],
                skill: null
            };
        }

        try {
            skillData = JSON.parse(fs.readFileSync(skillPath, 'utf8'));
        } catch (e) {
            return {
                valid: false,
                errors: [`Invalid JSON in ${skillPath}: ${e.message}`],
                warnings: [],
                skill: null
            };
        }
    } else {
        skillData = skillPathOrData;
        dirPath = skillDir || process.cwd();
        skillPath = path.join(dirPath, 'skill.json');
    }

    // Handle null/undefined skill data
    if (!skillData || typeof skillData !== 'object') {
        return {
            valid: false,
            errors: ['Skill data must be a non-null object'],
            warnings: [],
            skill: null,
            path: skillPath,
            dir: dirPath
        };
    }

    // Validate required fields
    if (!skillData.name) {
        errors.push('Missing required field: name');
    } else {
        // Validate name pattern
        if (!/^[a-z0-9-]+$/.test(skillData.name)) {
            errors.push(`Invalid name format: "${skillData.name}" (must be lowercase alphanumeric with hyphens only)`);
        }
    }

    if (!skillData.description) {
        errors.push('Missing required field: description');
    }

    // Validate version format if present
    if (skillData.version && !/^\d+\.\d+\.\d+$/.test(skillData.version)) {
        errors.push(`Invalid version format: "${skillData.version}" (expected semantic version X.Y.Z)`);
    }

    // Validate extends format if present
    if (skillData.extends) {
        if (!/^workspace:\/\/[a-z0-9-]+$/.test(skillData.extends)) {
            errors.push(`Invalid extends format: "${skillData.extends}" (expected workspace://skill-name)`);
        } else {
            // Check if the referenced skill exists
            const extendedSkillName = skillData.extends.replace('workspace://', '');
            const extendedSkillPath = path.join(getWorkspaceRoot(), '.claude', 'skills', extendedSkillName, 'skill.json');
            if (!fs.existsSync(extendedSkillPath)) {
                warnings.push(`Extended skill not found: ${skillData.extends}`);
            }
        }
    }

    // Validate team configuration
    if (skillData.team) {
        const teamErrors = validateTeamConfig(skillData.team);
        errors.push(...teamErrors);
    }

    // Validate adaptive configuration
    if (skillData.adaptive) {
        const adaptiveErrors = validateAdaptiveConfig(skillData.adaptive);
        errors.push(...adaptiveErrors);
    }

    // Validate workflow configuration
    if (skillData.workflow) {
        const workflowErrors = validateWorkflowConfig(skillData.workflow);
        errors.push(...workflowErrors);
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
        skill: errors.length === 0 ? skillData : null,
        path: skillPath,
        dir: dirPath
    };
}

/**
 * Validate team configuration
 * @param {Object} team - Team configuration object
 * @returns {string[]} Array of error messages
 */
export function validateTeamConfig(team) {
    const errors = [];

    if (!team || typeof team !== 'object') {
        return ['Team configuration must be an object'];
    }

    // Validate orchestrator
    if (team.orchestrator) {
        const orch = team.orchestrator;

        // Validate type
        if (orch.type) {
            const validTypes = ['dynamic', 'coordinator', 'specialist', 'foundation'];
            // Type can also be an agent ID
            if (!validTypes.includes(orch.type) && !hasAgent(orch.type)) {
                // Only error if it's not dynamic and not a known agent
                if (orch.type !== 'dynamic') {
                    errors.push(`Unknown orchestrator type or agent: "${orch.type}"`);
                }
            }
        }

        // Validate selection map
        if (orch.selection && typeof orch.selection !== 'object') {
            errors.push('Orchestrator selection must be an object');
        }
    }

    // Validate members
    if (team.members) {
        if (!Array.isArray(team.members)) {
            errors.push('Team members must be an array');
        } else {
            team.members.forEach((member, index) => {
                // Role is required
                if (!member.role) {
                    errors.push(`Team member at index ${index} missing required field: role`);
                }

                // Validate agent reference if present
                if (member.agent && member.agent !== 'dynamic') {
                    if (!hasAgent(member.agent)) {
                        errors.push(`Team member "${member.role || index}" references unknown agent: "${member.agent}"`);
                    }
                }

                // Validate phase
                if (member.phase) {
                    const validPhases = ['planning', 'implementation', 'verification', 'any'];
                    if (!validPhases.includes(member.phase)) {
                        errors.push(`Team member "${member.role || index}" has invalid phase: "${member.phase}"`);
                    }
                }

                // Validate parallel_with is array
                if (member.parallel_with !== undefined && !Array.isArray(member.parallel_with)) {
                    errors.push(`Team member "${member.role || index}" parallel_with must be an array`);
                }

                // Validate depends_on is array
                if (member.depends_on !== undefined && !Array.isArray(member.depends_on)) {
                    errors.push(`Team member "${member.role || index}" depends_on must be an array`);
                }
            });
        }
    }

    return errors;
}

/**
 * Validate adaptive configuration
 * @param {Object} adaptive - Adaptive configuration object
 * @returns {string[]} Array of error messages
 */
function validateAdaptiveConfig(adaptive) {
    const errors = [];

    if (adaptive.complexity) {
        const validLevels = ['small', 'medium', 'large'];

        for (const [level, config] of Object.entries(adaptive.complexity)) {
            if (!validLevels.includes(level)) {
                errors.push(`Unknown complexity level: "${level}" (expected: small, medium, large)`);
            }

            if (config.max_members !== undefined && (typeof config.max_members !== 'number' || config.max_members < 1)) {
                errors.push(`Complexity "${level}" max_members must be a positive integer`);
            }

            if (config.roles !== undefined && !Array.isArray(config.roles)) {
                errors.push(`Complexity "${level}" roles must be an array`);
            }
        }
    }

    if (adaptive.add_on_demand && typeof adaptive.add_on_demand !== 'object') {
        errors.push('add_on_demand must be an object');
    }

    return errors;
}

/**
 * Validate workflow configuration
 * @param {Object} workflow - Workflow configuration object
 * @returns {string[]} Array of error messages
 */
function validateWorkflowConfig(workflow) {
    const errors = [];

    if (workflow.next_skill && typeof workflow.next_skill !== 'string') {
        errors.push('workflow.next_skill must be a string');
    }

    if (workflow.modes && typeof workflow.modes !== 'object') {
        errors.push('workflow.modes must be an object');
    }

    return errors;
}

/**
 * Validate that SKILL.md exists in the skill directory
 * @param {string} skillDir - Path to skill directory
 * @returns {Object} Validation result {valid: boolean, error: string|null}
 */
export function validateSkillFiles(skillDir) {
    const skillMdPath = path.join(skillDir, 'SKILL.md');
    const skillJsonPath = path.join(skillDir, 'skill.json');

    const errors = [];

    if (!fs.existsSync(skillMdPath)) {
        errors.push(`SKILL.md not found in ${skillDir}`);
    }

    if (!fs.existsSync(skillJsonPath)) {
        errors.push(`skill.json not found in ${skillDir}`);
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Load and validate a skill from a directory
 * @param {string} skillDir - Path to skill directory
 * @returns {Object} {valid: boolean, errors: string[], warnings: string[], skill: Object|null}
 */
export function loadSkill(skillDir) {
    const skillJsonPath = path.join(skillDir, 'skill.json');

    // First validate files exist
    const filesResult = validateSkillFiles(skillDir);
    if (!filesResult.valid) {
        return {
            valid: false,
            errors: filesResult.errors,
            warnings: [],
            skill: null,
            dir: skillDir
        };
    }

    // Then validate the JSON structure
    const jsonResult = validateSkillJson(skillJsonPath);

    return {
        ...jsonResult,
        dir: skillDir
    };
}

/**
 * Validate all agent references in a skill
 * @param {Object} skillData - Parsed skill.json data
 * @returns {Object} {valid: boolean, unknownAgents: string[]}
 */
export function validateAgentReferences(skillData) {
    const unknownAgents = [];

    // Check team members
    if (skillData.team?.members) {
        for (const member of skillData.team.members) {
            if (member.agent && member.agent !== 'dynamic' && !hasAgent(member.agent)) {
                unknownAgents.push(member.agent);
            }
        }
    }

    // Check orchestrator
    if (skillData.team?.orchestrator?.type) {
        const type = skillData.team.orchestrator.type;
        const validTypes = ['dynamic', 'coordinator', 'specialist', 'foundation'];
        if (!validTypes.includes(type) && !hasAgent(type)) {
            unknownAgents.push(type);
        }

        // Check selection values
        if (skillData.team.orchestrator.selection) {
            for (const agentId of Object.values(skillData.team.orchestrator.selection)) {
                if (agentId !== 'dynamic' && !hasAgent(agentId)) {
                    unknownAgents.push(agentId);
                }
            }
        }
    }

    // Check adaptive add_on_demand values
    if (skillData.adaptive?.add_on_demand) {
        for (const agentId of Object.values(skillData.adaptive.add_on_demand)) {
            if (!hasAgent(agentId)) {
                unknownAgents.push(agentId);
            }
        }
    }

    return {
        valid: unknownAgents.length === 0,
        unknownAgents: [...new Set(unknownAgents)] // Remove duplicates
    };
}

/**
 * Validate a skill against the full schema
 * @param {Object} skillData - Parsed skill.json data
 * @returns {Object} {valid: boolean, errors: string[]}
 */
export function validateAgainstSchema(skillData) {
    const schema = loadSkillSchema();

    if (!schema || Object.keys(schema).length === 0) {
        return {
            valid: true,
            errors: [],
            warnings: ['Schema file not found or empty, skipping schema validation']
        };
    }

    // Simple schema validation for our use case
    // In production, you might want to use a proper JSON Schema validator like ajv
    const errors = [];

    // Type checking based on schema
    if (schema.properties) {
        for (const [key, value] of Object.entries(skillData)) {
            const propSchema = schema.properties[key];

            if (!propSchema) {
                if (schema.additionalProperties === false) {
                    errors.push(`Unknown property: ${key}`);
                }
                continue;
            }

            // Check type
            if (propSchema.type) {
                const actualType = Array.isArray(value) ? 'array' : typeof value;
                if (actualType !== propSchema.type) {
                    errors.push(`Property "${key}" has wrong type. Expected ${propSchema.type}, got ${actualType}`);
                }
            }

            // Check pattern
            if (propSchema.pattern && typeof value === 'string') {
                const regex = new RegExp(propSchema.pattern);
                if (!regex.test(value)) {
                    errors.push(`Property "${key}" does not match pattern: ${propSchema.pattern}`);
                }
            }

            // Check enum
            if (propSchema.enum && !propSchema.enum.includes(value)) {
                errors.push(`Property "${key}" must be one of: ${propSchema.enum.join(', ')}`);
            }
        }
    }

    // Check required fields
    if (schema.required) {
        for (const reqField of schema.required) {
            if (!(reqField in skillData)) {
                errors.push(`Missing required field: ${reqField}`);
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Get all skills in the workspace
 * @returns {Array} Array of {name, path, valid, errors}
 */
export function getAllSkills() {
    const skillsDir = path.join(getWorkspaceRoot(), '.claude', 'skills');
    const skills = [];

    if (!fs.existsSync(skillsDir)) {
        return skills;
    }

    const entries = fs.readdirSync(skillsDir, { withFileTypes: true });

    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name === 'schema') continue; // Skip schema directory

        const skillDir = path.join(skillsDir, entry.name);
        const result = loadSkill(skillDir);

        skills.push({
            name: entry.name,
            path: skillDir,
            valid: result.valid,
            errors: result.errors,
            warnings: result.warnings
        });
    }

    return skills;
}

/**
 * Validate all skills in the workspace
 * @returns {Object} {valid: boolean, skills: Array, totalErrors: number}
 */
export function validateAllSkills() {
    const skills = getAllSkills();
    let totalErrors = 0;

    for (const skill of skills) {
        totalErrors += skill.errors.length;
    }

    return {
        valid: totalErrors === 0,
        skills,
        totalErrors
    };
}
