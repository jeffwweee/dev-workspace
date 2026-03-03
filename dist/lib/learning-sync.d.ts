export interface Learning {
    type: 'pattern' | 'resolution';
    agent: string;
    content: string;
    extractedAt: string;
}
/**
 * Extracts learnings from agent memory file
 */
export declare function extractLearnings(agent: string): Learning[];
/**
 * Syncs learnings to Redis evolution registry
 */
export declare function syncToEvolutionRegistry(agent: string): {
    success: boolean;
    synced: number;
    total: number;
};
/**
 * Syncs all agents' learnings
 */
export declare function syncAllAgents(): {
    success: boolean;
    agents: Record<string, {
        synced: number;
        total: number;
    }>;
    totalSynced: number;
};
//# sourceMappingURL=learning-sync.d.ts.map