export interface SpawnOptions {
    name: string;
    persona?: string;
    role?: string;
    skills?: string[];
    memoryFile?: string;
    isAdhoc?: boolean;
    model?: 'sonnet' | 'opus' | 'haiku';
    style?: 'professional' | 'casual';
}
export interface SpawnResult {
    sessionName: string;
    status: 'spawned' | 'already_exists' | 'error';
    error?: string;
}
export declare const CORE_AGENTS: readonly ["backend", "frontend", "qa", "review-git"];
/**
 * Spawns a Claude Code agent in a tmux session
 * Uses CLAUDECODE workaround to allow nested Claude Code sessions
 *
 * Reference: modules/bots/scripts/start-telegram-agent.sh for:
 * - Model selection: claude --model sonnet|opus|haiku
 * - Persona injection: /telegram-agent --name <bot> --who "<persona>"
 * - Style configuration: --response-style professional|casual
 */
export declare function spawnAgent(options: SpawnOptions): SpawnResult;
/**
 * Kills an agent's tmux session
 */
export declare function killAgent(name: string, isAdhoc?: boolean): SpawnResult;
/**
 * Checks if an agent session is running
 */
export declare function isAgentRunning(name: string, isAdhoc?: boolean): boolean;
/**
 * Sends a command to an agent session
 */
export declare function sendToAgent(name: string, command: string, isAdhoc?: boolean): void;
/**
 * Lists all running agent sessions
 */
export declare function listAgentSessions(): string[];
/**
 * Gets list of core agent names
 */
export declare function getCoreAgents(): string[];
//# sourceMappingURL=spawn-agent.d.ts.map