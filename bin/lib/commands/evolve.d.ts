/**
 * Evolve CLI command - Interface to the evolution system
 *
 * Provides subcommands for:
 * - status: Show registry info and top genes
 * - solidify: Force solidify session signals
 * - export: Backup to file system
 * - publish: Mark gene as publishable
 */
export interface EvolveStatusResult {
    success: boolean;
    connected: boolean;
    error?: string;
    registry?: {
        totalGenes: number;
        topGenes: Array<{
            id: string;
            name: string;
            type: string;
            gdiScore: number;
            usageCount: number;
            successRate: number;
        }>;
    };
    recentEvents?: Array<{
        ts: string;
        type: string;
        category?: string;
        session?: string;
        data?: unknown;
    }>;
}
export interface EvolveSolidifyResult {
    success: boolean;
    error?: string;
    sessionId: string;
    signalsAnalyzed: number;
    candidates: number;
    message: string;
}
export interface EvolveExportResult {
    success: boolean;
    error?: string;
    genes?: {
        exported: number;
        genes: Array<{
            geneId: string;
            path: string;
        }>;
    };
    snapshot?: {
        path: string;
        genesExported: number;
        eventsExported: number;
    };
}
export interface EvolvePublishResult {
    success: boolean;
    error?: string;
    geneId: string;
    publishable: boolean;
    message: string;
}
/**
 * Show evolution system status
 */
export declare function evolveStatus(options?: {
    limit?: number;
}): Promise<EvolveStatusResult>;
/**
 * Force solidify session signals to gene candidates
 */
export declare function evolveSolidify(sessionId: string): Promise<EvolveSolidifyResult>;
/**
 * Export genes to file system backup
 */
export declare function evolveExport(): Promise<EvolveExportResult>;
/**
 * Mark a gene as publishable
 */
export declare function evolvePublish(geneId: string): Promise<EvolvePublishResult>;
//# sourceMappingURL=evolve.d.ts.map