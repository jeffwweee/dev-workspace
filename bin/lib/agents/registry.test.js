/**
 * Tests for Agent Registry Module
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import {
    getAgentRegistry,
    getAgent,
    hasAgent,
    getAgentsByType,
    getAgentsForDomain,
    getAgentIds,
    getAllAgents,
    getAgentsByCapability,
    validateRegistry,
    getRegistryVersion,
    getResolvedAgent,
    getRegistryPath,
    getSchemaPath
} from './registry.js';

describe('Agent Registry', () => {
    let registry;

    before(() => {
        registry = getAgentRegistry();
    });

    describe('getRegistryPath', () => {
        it('should return the correct registry path', () => {
            const path = getRegistryPath();
            assert.ok(path.endsWith('.claude/agents/registry.json'));
        });
    });

    describe('getSchemaPath', () => {
        it('should return the correct schema path', () => {
            const path = getSchemaPath();
            assert.ok(path.endsWith('.claude/agents/registry.schema.json'));
        });
    });

    describe('getAgentRegistry', () => {
        it('should return a registry object with version', () => {
            assert.ok(registry.version);
            assert.ok(/^\d+\.\d+$/.test(registry.version));
        });

        it('should return a registry with agents object', () => {
            assert.ok(registry.agents);
            assert.strictEqual(typeof registry.agents, 'object');
        });

        it('should have at least 13 agents defined', () => {
            const agentCount = Object.keys(registry.agents).length;
            assert.ok(agentCount >= 13, `Expected at least 13 agents, got ${agentCount}`);
        });
    });

    describe('getAgent', () => {
        it('should return agent configuration for valid ID', () => {
            const agent = getAgent('ts-specialist');
            assert.ok(agent);
            assert.strictEqual(agent.type, 'specialist');
            assert.strictEqual(agent.model, 'sonnet');
        });

        it('should return null for invalid ID', () => {
            const agent = getAgent('non-existent-agent');
            assert.strictEqual(agent, null);
        });

        it('should return orchestrator-agent correctly', () => {
            const agent = getAgent('orchestrator-agent');
            assert.ok(agent);
            assert.strictEqual(agent.type, 'coordinator');
            assert.strictEqual(agent.model, 'opus');
            assert.ok(agent.can_lead.includes('any'));
        });

        it('should return grammy-specialist with extends property', () => {
            const agent = getAgent('grammy-specialist');
            assert.ok(agent);
            assert.strictEqual(agent.extends, 'ts-specialist');
        });
    });

    describe('hasAgent', () => {
        it('should return true for existing agent', () => {
            assert.strictEqual(hasAgent('orchestrator-agent'), true);
            assert.strictEqual(hasAgent('ts-specialist'), true);
            assert.strictEqual(hasAgent('planner-agent'), true);
        });

        it('should return false for non-existing agent', () => {
            assert.strictEqual(hasAgent('fake-agent'), false);
            assert.strictEqual(hasAgent(''), false);
        });
    });

    describe('getAgentsByType', () => {
        it('should return all coordinator agents', () => {
            const coordinators = getAgentsByType('coordinator');
            const ids = Object.keys(coordinators);
            assert.ok(ids.includes('orchestrator-agent'));
            assert.strictEqual(ids.length, 1);
        });

        it('should return all specialist agents', () => {
            const specialists = getAgentsByType('specialist');
            const ids = Object.keys(specialists);
            assert.ok(ids.includes('ts-specialist'));
            assert.ok(ids.includes('python-specialist'));
            assert.ok(ids.includes('tester-agent'));
            assert.ok(ids.length >= 9, `Expected at least 9 specialists, got ${ids.length}`);
        });

        it('should return all foundation agents', () => {
            const foundation = getAgentsByType('foundation');
            const ids = Object.keys(foundation);
            assert.ok(ids.includes('planner-agent'));
            assert.ok(ids.includes('writer-agent'));
            assert.strictEqual(ids.length, 2);
        });

        it('should return empty object for unknown type', () => {
            const unknown = getAgentsByType('unknown-type');
            assert.strictEqual(Object.keys(unknown).length, 0);
        });
    });

    describe('getAgentsForDomain', () => {
        it('should return agents that can lead typescript domain', () => {
            const agents = getAgentsForDomain('typescript');
            const ids = Object.keys(agents);
            assert.ok(ids.includes('ts-specialist'));
            assert.ok(ids.includes('orchestrator-agent')); // has 'any'
        });

        it('should return orchestrator for any domain', () => {
            const agents = getAgentsForDomain('random-domain');
            assert.ok('orchestrator-agent' in agents);
        });

        it('should return agents for frontend domain', () => {
            const agents = getAgentsForDomain('frontend');
            const ids = Object.keys(agents);
            assert.ok(ids.includes('react-specialist'));
        });

        it('should return agents for python domain', () => {
            const agents = getAgentsForDomain('python');
            const ids = Object.keys(agents);
            assert.ok(ids.includes('python-specialist'));
        });

        it('should return agents for rust domain', () => {
            const agents = getAgentsForDomain('rust');
            const ids = Object.keys(agents);
            assert.ok(ids.includes('rust-specialist'));
        });

        it('should return agents for telegram domain', () => {
            const agents = getAgentsForDomain('telegram');
            const ids = Object.keys(agents);
            assert.ok(ids.includes('grammy-specialist'));
        });
    });

    describe('getAgentIds', () => {
        it('should return array of all agent IDs', () => {
            const ids = getAgentIds();
            assert.ok(Array.isArray(ids));
            assert.ok(ids.length >= 13);

            // Check for specific required agents
            const requiredAgents = [
                'orchestrator-agent',
                'planner-agent',
                'ts-specialist',
                'python-specialist',
                'rust-specialist',
                'react-specialist',
                'grammy-specialist',
                'tester-agent',
                'code-reviewer',
                'debugger-agent',
                'docs-agent',
                'git-agent',
                'writer-agent'
            ];

            for (const required of requiredAgents) {
                assert.ok(ids.includes(required), `Missing required agent: ${required}`);
            }
        });
    });

    describe('getAllAgents', () => {
        it('should return array of agents with id included', () => {
            const agents = getAllAgents();
            assert.ok(Array.isArray(agents));

            const tsAgent = agents.find(a => a.id === 'ts-specialist');
            assert.ok(tsAgent);
            assert.strictEqual(tsAgent.type, 'specialist');
            assert.strictEqual(tsAgent.model, 'sonnet');
        });
    });

    describe('getAgentsByCapability', () => {
        it('should return agents with typescript capability', () => {
            const agents = getAgentsByCapability('typescript');
            const ids = Object.keys(agents);
            assert.ok(ids.includes('ts-specialist'));
        });

        it('should return agents with git capability', () => {
            const agents = getAgentsByCapability('git');
            const ids = Object.keys(agents);
            assert.ok(ids.includes('git-agent'));
        });

        it('should return empty object for unknown capability', () => {
            const agents = getAgentsByCapability('nonexistent-capability');
            assert.strictEqual(Object.keys(agents).length, 0);
        });

        it('should return agents with documentation capability', () => {
            const agents = getAgentsByCapability('documentation');
            const ids = Object.keys(agents);
            assert.ok(ids.includes('docs-agent'));
        });
    });

    describe('validateRegistry', () => {
        it('should validate the registry successfully', () => {
            const result = validateRegistry();
            assert.strictEqual(result.valid, true, `Validation failed: ${result.errors.join(', ')}`);
            assert.strictEqual(result.errors.length, 0);
        });
    });

    describe('getRegistryVersion', () => {
        it('should return the registry version', () => {
            const version = getRegistryVersion();
            assert.ok(/^\d+\.\d+$/.test(version));
        });
    });

    describe('getResolvedAgent', () => {
        it('should return agent without changes if no extends', () => {
            const agent = getResolvedAgent('ts-specialist');
            assert.ok(agent);
            assert.strictEqual(agent.id, 'ts-specialist');
            assert.strictEqual(agent.type, 'specialist');
        });

        it('should merge extended agent capabilities', () => {
            const agent = getResolvedAgent('grammy-specialist');
            assert.ok(agent);
            assert.strictEqual(agent.id, 'grammy-specialist');

            // Should have both ts-specialist and grammy-specialist capabilities
            assert.ok(agent.capabilities.includes('typescript')); // from ts-specialist
            assert.ok(agent.capabilities.includes('grammy')); // from grammy-specialist
        });

        it('should return null for non-existent agent', () => {
            const agent = getResolvedAgent('non-existent');
            assert.strictEqual(agent, null);
        });

        it('should have parent tools if child does not define', () => {
            const grammy = getResolvedAgent('grammy-specialist');
            assert.ok(grammy.tools);
            assert.ok(Array.isArray(grammy.tools));
        });
    });

    describe('Required Agents', () => {
        it('should have all 13 required agents with proper structure', () => {
            const requiredAgents = [
                { id: 'orchestrator-agent', type: 'coordinator', model: 'opus' },
                { id: 'planner-agent', type: 'foundation', model: 'opus' },
                { id: 'ts-specialist', type: 'specialist', model: 'sonnet' },
                { id: 'python-specialist', type: 'specialist', model: 'sonnet' },
                { id: 'rust-specialist', type: 'specialist', model: 'sonnet' },
                { id: 'react-specialist', type: 'specialist', model: 'sonnet' },
                { id: 'grammy-specialist', type: 'specialist', model: 'sonnet' },
                { id: 'tester-agent', type: 'specialist', model: 'haiku' },
                { id: 'code-reviewer', type: 'specialist', model: 'sonnet' },
                { id: 'debugger-agent', type: 'specialist', model: 'sonnet' },
                { id: 'docs-agent', type: 'specialist', model: 'haiku' },
                { id: 'git-agent', type: 'specialist', model: 'haiku' },
                { id: 'writer-agent', type: 'foundation', model: 'haiku' }
            ];

            for (const expected of requiredAgents) {
                const agent = getAgent(expected.id);
                assert.ok(agent, `Agent ${expected.id} not found`);
                assert.strictEqual(agent.type, expected.type,
                    `Agent ${expected.id} has wrong type: ${agent.type}`);
                assert.strictEqual(agent.model, expected.model,
                    `Agent ${expected.id} has wrong model: ${agent.model}`);
                assert.ok(agent.description, `Agent ${expected.id} missing description`);
                assert.ok(agent.capabilities, `Agent ${expected.id} missing capabilities`);
                assert.ok(Array.isArray(agent.capabilities), `Agent ${expected.id} capabilities not array`);
                assert.ok(agent.capabilities.length > 0, `Agent ${expected.id} has no capabilities`);
                assert.strictEqual(typeof agent.stable, 'boolean',
                    `Agent ${expected.id} stable must be boolean`);
            }
        });
    });

    describe('Agent data integrity', () => {
        it('should have valid model assignments for all agents', () => {
            const validModels = ['opus', 'sonnet', 'haiku'];
            const agents = getAllAgents();

            for (const agent of agents) {
                assert.ok(validModels.includes(agent.model),
                    `Invalid model for ${agent.id}: ${agent.model}`);
            }
        });

        it('should have valid type assignments for all agents', () => {
            const validTypes = ['coordinator', 'foundation', 'specialist'];
            const agents = getAllAgents();

            for (const agent of agents) {
                assert.ok(validTypes.includes(agent.type),
                    `Invalid type for ${agent.id}: ${agent.type}`);
            }
        });

        it('should have proper extends relationships', () => {
            const agents = getAllAgents();

            for (const agent of agents) {
                if (agent.extends) {
                    assert.ok(hasAgent(agent.extends),
                        `Agent ${agent.id} extends non-existent agent ${agent.extends}`);
                }
            }
        });

        it('should have system_prompt for all agents', () => {
            const agents = getAllAgents();

            for (const agent of agents) {
                assert.ok(agent.system_prompt,
                    `Agent ${agent.id} missing system_prompt`);
                assert.ok(agent.system_prompt.length >= 50,
                    `Agent ${agent.id} system_prompt too short`);
            }
        });
    });
});
