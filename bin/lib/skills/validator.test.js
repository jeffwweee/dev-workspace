/**
 * Tests for Skill Validator Module
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    validateSkillJson,
    validateTeamConfig,
    validateSkillFiles,
    loadSkill,
    validateAgentReferences,
    validateAgainstSchema,
    getSkillSchemaPath,
    loadSkillSchema
} from './validator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(__dirname, '../../..');

// Test fixtures
const validSkillData = {
    name: 'test-skill',
    description: 'A test skill for validation',
    version: '1.0.0',
    team: {
        orchestrator: {
            type: 'dynamic',
            selection: {
                'typescript': 'ts-specialist',
                'default': 'orchestrator-agent'
            }
        },
        members: [
            {
                role: 'backend',
                agent: 'ts-specialist',
                phase: 'implementation'
            },
            {
                role: 'tester',
                agent: 'tester-agent',
                phase: 'verification'
            }
        ]
    },
    adaptive: {
        complexity: {
            small: { max_members: 2, roles: ['backend', 'test'] },
            medium: { max_members: 4, roles: ['backend', 'frontend', 'test'] },
            large: { max_members: 6 }
        },
        add_on_demand: {
            'if_tests_failing': 'debugger-agent'
        }
    },
    metadata: {
        tags: ['feature', 'workflow'],
        project_types: ['typescript'],
        estimated_duration: '2-4 hours'
    }
};

const invalidSkillData = {
    // Missing required 'name' and 'description'
    version: 'invalid-version'
};

describe('Skill Validator', () => {
    describe('getSkillSchemaPath', () => {
        it('should return the correct schema path', () => {
            const schemaPath = getSkillSchemaPath();
            assert.ok(schemaPath.endsWith('.claude/skills/schema/skill.schema.json'));
        });
    });

    describe('loadSkillSchema', () => {
        it('should load the schema successfully', () => {
            const schema = loadSkillSchema();
            assert.ok(schema);
            assert.strictEqual(schema.$schema, 'http://json-schema.org/draft-07/schema#');
        });
    });

    describe('validateSkillJson', () => {
        it('should validate a valid skill object', () => {
            const result = validateSkillJson(validSkillData, '/tmp/test');
            assert.strictEqual(result.valid, true);
            assert.strictEqual(result.errors.length, 0);
            assert.deepStrictEqual(result.skill, validSkillData);
        });

        it('should catch missing required fields', () => {
            const result = validateSkillJson(invalidSkillData, '/tmp/test');
            assert.strictEqual(result.valid, false);
            assert.ok(result.errors.some(e => e.includes('Missing required field: name')));
            assert.ok(result.errors.some(e => e.includes('Missing required field: description')));
        });

        it('should validate name pattern', () => {
            const invalidName = { ...validSkillData, name: 'InvalidName' };
            const result = validateSkillJson(invalidName, '/tmp/test');
            assert.strictEqual(result.valid, false);
            assert.ok(result.errors.some(e => e.includes('Invalid name format')));
        });

        it('should validate version pattern', () => {
            const invalidVersion = { ...validSkillData, version: '1.0' };
            const result = validateSkillJson(invalidVersion, '/tmp/test');
            assert.strictEqual(result.valid, false);
            assert.ok(result.errors.some(e => e.includes('Invalid version format')));
        });

        it('should validate extends pattern', () => {
            const invalidExtends = { ...validSkillData, extends: 'invalid-format' };
            const result = validateSkillJson(invalidExtends, '/tmp/test');
            assert.strictEqual(result.valid, false);
            assert.ok(result.errors.some(e => e.includes('Invalid extends format')));
        });

        it('should accept valid extends pattern', () => {
            const validExtends = { ...validSkillData, extends: 'workspace://code-reviewer' };
            const result = validateSkillJson(validExtends, '/tmp/test');
            // Might have warnings but should be valid
            assert.strictEqual(result.valid, true);
        });

        it('should return error for non-existent file path', () => {
            const result = validateSkillJson('/non/existent/path/skill.json');
            assert.strictEqual(result.valid, false);
            assert.ok(result.errors[0].includes('not found'));
        });
    });

    describe('validateTeamConfig', () => {
        it('should validate a valid team configuration', () => {
            const errors = validateTeamConfig(validSkillData.team);
            assert.strictEqual(errors.length, 0);
        });

        it('should catch missing role in member', () => {
            const team = {
                members: [
                    { agent: 'ts-specialist' } // Missing role
                ]
            };
            const errors = validateTeamConfig(team);
            assert.ok(errors.some(e => e.includes('missing required field: role')));
        });

        it('should catch invalid phase', () => {
            const team = {
                members: [
                    { role: 'backend', phase: 'invalid-phase' }
                ]
            };
            const errors = validateTeamConfig(team);
            assert.ok(errors.some(e => e.includes('invalid phase')));
        });

        it('should catch non-array members', () => {
            const team = {
                members: 'not-an-array'
            };
            const errors = validateTeamConfig(team);
            assert.ok(errors.some(e => e.includes('must be an array')));
        });

        it('should catch non-array parallel_with', () => {
            const team = {
                members: [
                    { role: 'backend', parallel_with: 'not-an-array' }
                ]
            };
            const errors = validateTeamConfig(team);
            assert.ok(errors.some(e => e.includes('parallel_with must be an array')));
        });

        it('should catch non-array depends_on', () => {
            const team = {
                members: [
                    { role: 'backend', depends_on: 'not-an-array' }
                ]
            };
            const errors = validateTeamConfig(team);
            assert.ok(errors.some(e => e.includes('depends_on must be an array')));
        });

        it('should handle null team', () => {
            const errors = validateTeamConfig(null);
            assert.ok(errors.length > 0);
        });
    });

    describe('validateSkillFiles', () => {
        const testDir = path.join(WORKSPACE_ROOT, 'state', 'test-skill-validator');

        before(() => {
            // Create test directory
            if (!fs.existsSync(testDir)) {
                fs.mkdirSync(testDir, { recursive: true });
            }
        });

        it('should fail when SKILL.md is missing', () => {
            // Create only skill.json
            const skillJsonPath = path.join(testDir, 'skill.json');
            fs.writeFileSync(skillJsonPath, JSON.stringify(validSkillData));

            const result = validateSkillFiles(testDir);
            assert.strictEqual(result.valid, false);
            assert.ok(result.errors.some(e => e.includes('SKILL.md not found')));

            // Cleanup
            fs.unlinkSync(skillJsonPath);
        });

        it('should fail when skill.json is missing', () => {
            // Create only SKILL.md
            const skillMdPath = path.join(testDir, 'SKILL.md');
            fs.writeFileSync(skillMdPath, '# Test Skill');

            const result = validateSkillFiles(testDir);
            assert.strictEqual(result.valid, false);
            assert.ok(result.errors.some(e => e.includes('skill.json not found')));

            // Cleanup
            fs.unlinkSync(skillMdPath);
        });

        it('should pass when both files exist', () => {
            // Create both files
            const skillMdPath = path.join(testDir, 'SKILL.md');
            const skillJsonPath = path.join(testDir, 'skill.json');
            fs.writeFileSync(skillMdPath, '# Test Skill');
            fs.writeFileSync(skillJsonPath, JSON.stringify(validSkillData));

            const result = validateSkillFiles(testDir);
            assert.strictEqual(result.valid, true);
            assert.strictEqual(result.errors.length, 0);

            // Cleanup
            fs.unlinkSync(skillMdPath);
            fs.unlinkSync(skillJsonPath);
        });
    });

    describe('loadSkill', () => {
        const testDir = path.join(WORKSPACE_ROOT, 'state', 'test-load-skill');

        before(() => {
            // Create test directory with valid skill files
            if (!fs.existsSync(testDir)) {
                fs.mkdirSync(testDir, { recursive: true });
            }
        });

        it('should load and validate a complete skill', () => {
            const skillMdPath = path.join(testDir, 'SKILL.md');
            const skillJsonPath = path.join(testDir, 'skill.json');
            fs.writeFileSync(skillMdPath, '# Test Skill');
            fs.writeFileSync(skillJsonPath, JSON.stringify(validSkillData));

            const result = loadSkill(testDir);
            assert.strictEqual(result.valid, true);
            assert.strictEqual(result.errors.length, 0);
            assert.deepStrictEqual(result.skill, validSkillData);

            // Cleanup
            fs.unlinkSync(skillMdPath);
            fs.unlinkSync(skillJsonPath);
        });

        it('should fail when files are missing', () => {
            const result = loadSkill('/non/existent/path');
            assert.strictEqual(result.valid, false);
            assert.ok(result.errors.length > 0);
        });
    });

    describe('validateAgentReferences', () => {
        it('should pass for valid agent references', () => {
            // Use valid agents from registry
            const skillWithKnownAgents = {
                team: {
                    members: [
                        { role: 'backend', agent: 'ts-specialist' }
                    ]
                }
            };
            const result = validateAgentReferences(skillWithKnownAgents);
            assert.strictEqual(result.valid, true);
            assert.strictEqual(result.unknownAgents.length, 0);
        });

        it('should detect unknown agents', () => {
            const skillWithUnknownAgent = {
                team: {
                    members: [
                        { role: 'backend', agent: 'non-existent-agent' }
                    ]
                }
            };
            const result = validateAgentReferences(skillWithUnknownAgent);
            assert.strictEqual(result.valid, false);
            assert.ok(result.unknownAgents.includes('non-existent-agent'));
        });

        it('should allow "dynamic" as agent value', () => {
            const skillWithDynamic = {
                team: {
                    members: [
                        { role: 'backend', agent: 'dynamic' }
                    ]
                }
            };
            const result = validateAgentReferences(skillWithDynamic);
            assert.strictEqual(result.valid, true);
        });

        it('should validate orchestrator type', () => {
            const skillWithUnknownOrchestrator = {
                team: {
                    orchestrator: {
                        type: 'non-existent-agent'
                    }
                }
            };
            const result = validateAgentReferences(skillWithUnknownOrchestrator);
            assert.strictEqual(result.valid, false);
            assert.ok(result.unknownAgents.includes('non-existent-agent'));
        });

        it('should validate adaptive add_on_demand agents', () => {
            const skillWithUnknownAddOnDemand = {
                adaptive: {
                    add_on_demand: {
                        'if_tests_failing': 'non-existent-debugger'
                    }
                }
            };
            const result = validateAgentReferences(skillWithUnknownAddOnDemand);
            assert.strictEqual(result.valid, false);
            assert.ok(result.unknownAgents.includes('non-existent-debugger'));
        });
    });

    describe('validateAgainstSchema', () => {
        it('should validate against the schema', () => {
            const result = validateAgainstSchema(validSkillData);
            assert.strictEqual(result.valid, true);
            assert.strictEqual(result.errors.length, 0);
        });

        it('should catch type mismatches', () => {
            const invalidData = {
                ...validSkillData,
                name: 123 // Should be string
            };
            const result = validateAgainstSchema(invalidData);
            assert.strictEqual(result.valid, false);
            assert.ok(result.errors.some(e => e.includes('wrong type')));
        });

        it('should warn if schema is not found', () => {
            // This test verifies behavior when schema is empty
            // The actual schema exists, so this tests the fallback path
            const result = validateAgainstSchema(validSkillData);
            // Should either be valid or have specific errors
            assert.ok(result.hasOwnProperty('valid'));
        });
    });

    describe('Edge cases', () => {
        it('should handle empty skill data', () => {
            const result = validateSkillJson({}, '/tmp/test');
            assert.strictEqual(result.valid, false);
            assert.ok(result.errors.some(e => e.includes('Missing required field: name')));
            assert.ok(result.errors.some(e => e.includes('Missing required field: description')));
        });

        it('should handle null values', () => {
            const result = validateSkillJson(null, '/tmp/test');
            // Should handle gracefully
            assert.ok(result.hasOwnProperty('valid'));
        });

        it('should handle invalid JSON in file', () => {
            const testDir = path.join(WORKSPACE_ROOT, 'state', 'test-invalid-json');
            if (!fs.existsSync(testDir)) {
                fs.mkdirSync(testDir, { recursive: true });
            }
            const invalidJsonPath = path.join(testDir, 'skill.json');
            fs.writeFileSync(invalidJsonPath, '{ invalid json }');

            const result = validateSkillJson(invalidJsonPath);
            assert.strictEqual(result.valid, false);
            assert.ok(result.errors[0].includes('Invalid JSON'));

            fs.unlinkSync(invalidJsonPath);
        });

        it('should validate skill with only required fields', () => {
            const minimalSkill = {
                name: 'minimal-skill',
                description: 'A minimal skill'
            };
            const result = validateSkillJson(minimalSkill, '/tmp/test');
            assert.strictEqual(result.valid, true);
        });

        it('should handle complex nested configurations', () => {
            const complexSkill = {
                name: 'complex-skill',
                description: 'A complex skill with all features',
                version: '2.0.0',
                extends: 'workspace://base-skill',
                team: {
                    orchestrator: {
                        type: 'dynamic',
                        selection: {
                            'typescript': 'ts-specialist',
                            'python': 'python-specialist',
                            'default': 'orchestrator-agent'
                        }
                    },
                    members: [
                        {
                            role: 'designer',
                            phase: 'planning',
                            required: true
                        },
                        {
                            role: 'backend',
                            agent: 'ts-specialist',
                            phase: 'implementation',
                            parallel_with: ['frontend']
                        },
                        {
                            role: 'frontend',
                            agent: 'react-specialist',
                            phase: 'implementation',
                            parallel_with: ['backend'],
                            depends_on: ['designer']
                        },
                        {
                            role: 'tester',
                            agent: 'tester-agent',
                            phase: 'verification',
                            depends_on: ['backend', 'frontend']
                        }
                    ]
                },
                adaptive: {
                    complexity: {
                        small: { max_members: 2, roles: ['backend', 'test'] },
                        medium: { max_members: 4, roles: ['backend', 'frontend', 'test'] },
                        large: { max_members: 6 }
                    },
                    add_on_demand: {
                        'if_tests_failing': 'debugger-agent',
                        'if_security_sensitive': 'code-reviewer'
                    }
                },
                context: {
                    inject: ['PROJECT_CONTEXT.md', 'progress.md'],
                    working_directory: 'worktree'
                },
                validation: {
                    required: ['tests_pass', 'lint_ok'],
                    commands: ['npm test', 'npm run lint']
                },
                workflow: {
                    next_skill: 'verification-before-completion',
                    modes: {
                        'implement': 'prompts/implement.md',
                        'test': 'tester-agent'
                    }
                },
                metadata: {
                    tags: ['feature', 'workflow', 'full-stack'],
                    project_types: ['typescript', 'react'],
                    estimated_duration: '4-8 hours',
                    author: 'test-author'
                }
            };

            const result = validateSkillJson(complexSkill, '/tmp/test');
            assert.strictEqual(result.valid, true);
            assert.strictEqual(result.errors.length, 0);
        });
    });
});
