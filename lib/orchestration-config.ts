import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_PATH = path.join(__dirname, '..', 'config', 'orchestration.yml');

export interface BotConfig {
  name: string;
  token: string;
  username?: string;
  role: string;
  tmux: {
    session: string;
    window?: number;
    pane?: number;
  };
  agent_config?: {
    skills?: string[];
    memory?: string;
    outputs?: string[];
  };
  permissions?: {
    allowed_chats?: number[];
    admin_users?: number[];
  };
}

export interface WorkflowConfig {
  pipeline: string[];
  review_threshold: number;
  max_retries?: number;
  retry_backoff_base_ms?: number;
}

export interface OrchestrationConfig {
  bots: BotConfig[];
  workflows: Record<string, WorkflowConfig>;
  limits: {
    max_adhoc_per_type: number;
    max_total_adhoc: number;
    max_queue_length: number;
    adhoc_idle_timeout_ms: number;
  };
  orchestrator: {
    loop_interval_ms: number;
    telegram_poll_interval_ms: number;
    plan_watch_enabled: boolean;
    plan_watch_paths: string[];
  };
  archiving: {
    max_file_size_kb: number;
    max_task_count: number;
    weekly_archive: boolean;
  };
  cleanup: {
    adhoc_idle_timeout_ms: number;
    core_agent_clear_on_complete: boolean;
  };
}

let cachedConfig: OrchestrationConfig | null = null;

/**
 * Loads orchestration configuration
 */
export function loadConfig(): OrchestrationConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`Configuration file not found: ${CONFIG_PATH}`);
  }

  const content = fs.readFileSync(CONFIG_PATH, 'utf-8');
  cachedConfig = yaml.load(content) as OrchestrationConfig;
  return cachedConfig!;
}

/**
 * Gets a specific workflow configuration
 */
export function getWorkflow(workflowName = 'default'): WorkflowConfig {
  const config = loadConfig();
  return config.workflows[workflowName] || config.workflows.default;
}

/**
 * Gets bot by role
 */
export function getBotByRole(role: string): BotConfig | undefined {
  const config = loadConfig();
  return config.bots.find(b => b.role === role);
}

/**
 * Gets all bots
 */
export function getBots(): BotConfig[] {
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
export function clearCache(): void {
  cachedConfig = null;
}
