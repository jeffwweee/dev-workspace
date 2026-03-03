export interface AdhocInfo {
    type: string;
    spawnedAt: number;
    lastActivity: number;
    taskId?: string;
}
/**
 * Gets current adhoc counts by type
 */
export declare function getAdhocCounts(): Record<string, number>;
/**
 * Checks if can spawn adhoc of type
 */
export declare function canSpawnAdhoc(type: string): {
    canSpawn: boolean;
    reason?: string;
    typeRemaining?: number;
    totalRemaining?: number;
};
/**
 * Spawns an adhoc agent
 */
export declare function spawnAdhocAgent(type: string, options?: {
    taskId?: string;
    persona?: string;
    skills?: string[];
}): {
    success: boolean;
    sessionName?: string;
    reason?: string;
};
/**
 * Kills an adhoc agent
 */
export declare function killAdhocAgent(sessionName: string): {
    success: boolean;
    reason?: string;
};
/**
 * Updates adhoc agent activity
 */
export declare function updateAdhocActivity(sessionName: string): void;
/**
 * Finds idle adhoc agents
 */
export declare function findIdleAdhocAgents(timeoutMs?: number): string[];
/**
 * Cleans up idle adhoc agents
 */
export declare function cleanupIdleAdhocAgents(timeoutMs?: number): {
    checked: number;
    killed: number;
    killedSessions: string[];
};
/**
 * Lists all adhoc agents
 */
export declare function listAdhocAgents(): Array<{
    sessionName: string;
    running: boolean;
} & AdhocInfo>;
//# sourceMappingURL=adhoc-manager.d.ts.map