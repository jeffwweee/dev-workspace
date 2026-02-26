/**
 * Bots Command Module
 *
 * CLI commands for tg-bots gateway management:
 * - start: Start the gateway with PM2
 * - stop: Stop the gateway
 * - restart: Restart the gateway
 * - status: Show gateway status
 * - logs: View gateway logs
 * - config: Validate/show bot configuration
 */
export interface BotsOptions {
    json?: boolean;
    follow?: boolean;
    lines?: number;
}
export interface BotsResult {
    success: boolean;
    error?: string;
    message?: string;
    hint?: string;
    running?: boolean;
    process?: unknown;
    config?: unknown;
    path?: string;
    examplePath?: string;
}
/**
 * Start the gateway
 */
export declare function botsStart(options?: BotsOptions): Promise<BotsResult>;
/**
 * Stop the gateway
 */
export declare function botsStop(options?: BotsOptions): Promise<BotsResult>;
/**
 * Restart the gateway
 */
export declare function botsRestart(options?: BotsOptions): Promise<BotsResult>;
/**
 * Show gateway status
 */
export declare function botsStatus(options?: BotsOptions): Promise<BotsResult>;
/**
 * View gateway logs
 */
export declare function botsLogs(options?: BotsOptions): Promise<BotsResult>;
/**
 * Validate/show configuration
 */
export declare function botsConfig(options?: BotsOptions): Promise<BotsResult>;
/**
 * Main bots command router
 */
export declare function botsCommand(subcommand?: string, args?: string[], options?: BotsOptions): Promise<BotsResult>;
//# sourceMappingURL=bots.d.ts.map