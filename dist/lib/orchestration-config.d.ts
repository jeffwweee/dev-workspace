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
        persona?: string;
        role_skill?: string;
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
/**
 * Loads orchestration configuration
 */
export declare function loadConfig(): OrchestrationConfig;
/**
 * Gets a specific workflow configuration
 */
export declare function getWorkflow(workflowName?: string): WorkflowConfig;
/**
 * Gets bot by role
 */
export declare function getBotByRole(role: string): BotConfig | undefined;
/**
 * Gets all bots
 */
export declare function getBots(): BotConfig[];
/**
 * Gets limits configuration
 */
export declare function getLimits(): {
    max_adhoc_per_type: number;
    max_total_adhoc: number;
    max_queue_length: number;
    adhoc_idle_timeout_ms: number;
};
/**
 * Gets orchestrator settings
 */
export declare function getOrchestratorSettings(): {
    loop_interval_ms: number;
    telegram_poll_interval_ms: number;
    plan_watch_enabled: boolean;
    plan_watch_paths: string[];
};
/**
 * Clears config cache (for testing)
 */
export declare function clearCache(): void;
//# sourceMappingURL=orchestration-config.d.ts.map