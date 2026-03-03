import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = path.join(__dirname, '..', 'config', 'orchestration.yml');
let cachedConfig = null;
/**
 * Loads orchestration configuration
 */
export function loadConfig() {
    if (cachedConfig) {
        return cachedConfig;
    }
    if (!fs.existsSync(CONFIG_PATH)) {
        throw new Error(`Configuration file not found: ${CONFIG_PATH}`);
    }
    const content = fs.readFileSync(CONFIG_PATH, 'utf-8');
    cachedConfig = yaml.load(content);
    return cachedConfig;
}
/**
 * Gets a specific workflow configuration
 */
export function getWorkflow(workflowName = 'default') {
    const config = loadConfig();
    return config.workflows[workflowName] || config.workflows.default;
}
/**
 * Gets bot by role
 */
export function getBotByRole(role) {
    const config = loadConfig();
    return config.bots.find(b => b.role === role);
}
/**
 * Gets all bots
 */
export function getBots() {
    const config = loadConfig();
    return config.bots;
}
/**
 * Gets limits configuration
 */
export function getLimits() {
    const config = loadConfig();
    return config.limits;
}
/**
 * Gets orchestrator settings
 */
export function getOrchestratorSettings() {
    const config = loadConfig();
    return config.orchestrator;
}
/**
 * Clears config cache (for testing)
 */
export function clearCache() {
    cachedConfig = null;
}
//# sourceMappingURL=orchestration-config.js.map