/**
 * Agent Registry Access Module
 *
 * Provides functions to access and query the agent registry.
 * Agents are core worker types stored in a stable registry.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { readJson, getWorkspaceRoot } from '../state/manager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Get the path to the agent registry file
 * @returns {string} Absolute path to registry.json
 */
export function getRegistryPath() {
    return path.join(getWorkspaceRoot(), '.claude', 'agents', 'registry.json');
}

/**
 * Get the path to the registry schema file
 * @returns {string} Absolute path to registry.schema.json
 */
export function getSchemaPath() {
    return path.join(getWorkspaceRoot(), '.claude', 'agents', 'registry.schema.json');
}

/**
 * Load and return the complete agent registry
 * @returns {Object} The registry object with version and agents
 */
export function getAgentRegistry() {
    const registryPath = getRegistryPath();
    return readJson(registryPath, {
        version: '1.0',
        agents: {}
    });
}

/**
 * Get a specific agent by ID
 * @param {string} agentId - The agent identifier (e.g., 'ts-specialist')
 * @returns {Object|null} The agent configuration or null if not found
 */
export function getAgent(agentId) {
    const registry = getAgentRegistry();
    return registry.agents[agentId] || null;
}

/**
 * Check if an agent exists in the registry
 * @param {string} agentId - The agent identifier
 * @returns {boolean} True if agent exists
 */
export function hasAgent(agentId) {
    const registry = getAgentRegistry();
    return agentId in registry.agents;
}

/**
 * Get all agents of a specific type
 * @param {string} type - Agent type: 'coordinator', 'specialist', or 'foundation'
 * @returns {Object} Map of agent ID to agent configuration
 */
export function getAgentsByType(type) {
    const registry = getAgentRegistry();
    const result = {};

    for (const [id, agent] of Object.entries(registry.agents)) {
        if (agent.type === type) {
            result[id] = agent;
        }
    }

    return result;
}

/**
 * Get agents that can lead work in a specific domain
 * @param {string} domain - The domain to check (e.g., 'typescript', 'frontend')
 * @returns {Object} Map of agent ID to agent configuration
 */
export function getAgentsForDomain(domain) {
    const registry = getAgentRegistry();
    const result = {};

    for (const [id, agent] of Object.entries(registry.agents)) {
        if (agent.can_lead && (agent.can_lead.includes(domain) || agent.can_lead.includes('any'))) {
            result[id] = agent;
        }
    }

    return result;
}

/**
 * Get all agent IDs from the registry
 * @returns {string[]} Array of agent IDs
 */
export function getAgentIds() {
    const registry = getAgentRegistry();
    return Object.keys(registry.agents);
}

/**
 * Get all agents as an array
 * @returns {Array} Array of {id, ...agent} objects
 */
export function getAllAgents() {
    const registry = getAgentRegistry();
    return Object.entries(registry.agents).map(([id, agent]) => ({
        id,
        ...agent
    }));
}

/**
 * Get agents that have a specific capability
 * @param {string} capability - The capability to search for
 * @returns {Object} Map of agent ID to agent configuration
 */
export function getAgentsByCapability(capability) {
    const registry = getAgentRegistry();
    const result = {};

    for (const [id, agent] of Object.entries(registry.agents)) {
        if (agent.capabilities && agent.capabilities.includes(capability)) {
            result[id] = agent;
        }
    }

    return result;
}

/**
 * Validate the registry structure
 * @returns {Object} Validation result {valid: boolean, errors: string[]}
 */
export function validateRegistry() {
    const registry = getAgentRegistry();
    const errors = [];

    // Check version format
    if (!registry.version || !/^\d+\.\d+$/.test(registry.version)) {
        errors.push(`Invalid version format: ${registry.version} (expected: X.Y)`);
    }

    // Check agents exist
    if (!registry.agents || typeof registry.agents !== 'object') {
        errors.push('Registry must have an "agents" object');
        return { valid: false, errors };
    }

    // Validate each agent
    const validTypes = ['coordinator', 'specialist', 'foundation'];
    const validModels = ['opus', 'sonnet', 'haiku'];
    const requiredFields = ['type', 'description', 'capabilities', 'model', 'stable'];

    for (const [id, agent] of Object.entries(registry.agents)) {
        // Check required fields
        for (const field of requiredFields) {
            if (!(field in agent)) {
                errors.push(`Agent "${id}" missing required field: ${field}`);
            }
        }

        // Validate type
        if (agent.type && !validTypes.includes(agent.type)) {
            errors.push(`Agent "${id}" has invalid type: ${agent.type} (expected: ${validTypes.join(', ')})`);
        }

        // Validate model
        if (agent.model && !validModels.includes(agent.model)) {
            errors.push(`Agent "${id}" has invalid model: ${agent.model} (expected: ${validModels.join(', ')})`);
        }

        // Validate capabilities is array
        if (agent.capabilities && !Array.isArray(agent.capabilities)) {
            errors.push(`Agent "${id}" capabilities must be an array`);
        }

        // Validate can_lead is array if present
        if (agent.can_lead !== undefined && !Array.isArray(agent.can_lead)) {
            errors.push(`Agent "${id}" can_lead must be an array`);
        }

        // Validate extends references existing agent
        if (agent.extends && !registry.agents[agent.extends]) {
            errors.push(`Agent "${id}" extends non-existent agent: ${agent.extends}`);
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Get the registry version
 * @returns {string} Version string
 */
export function getRegistryVersion() {
    const registry = getAgentRegistry();
    return registry.version || '0.0';
}

/**
 * Get resolved agent configuration (with extends merged)
 * @param {string} agentId - The agent identifier
 * @returns {Object|null} Resolved agent configuration or null
 */
export function getResolvedAgent(agentId) {
    const agent = getAgent(agentId);
    if (!agent) return null;

    if (!agent.extends) {
        return { id: agentId, ...agent };
    }

    const parentAgent = getAgent(agent.extends);
    if (!parentAgent) {
        return { id: agentId, ...agent };
    }

    // Merge parent with child (child takes precedence)
    const resolved = {
        ...parentAgent,
        ...agent,
        capabilities: [...new Set([
            ...(parentAgent.capabilities || []),
            ...(agent.capabilities || [])
        ])],
        tools: agent.tools || parentAgent.tools || [],
        can_lead: [...new Set([
            ...(parentAgent.can_lead || []),
            ...(agent.can_lead || [])
        ])]
    };

    return { id: agentId, ...resolved };
}
