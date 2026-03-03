/**
 * Checks if archiving is needed
 */
export declare function needsArchiving(filePath: string): {
    needed: boolean;
    reason?: string;
};
/**
 * Archives a memory file
 */
export declare function archiveMemoryFile(agent: string): {
    success: boolean;
    archived: boolean;
    archivePath?: string;
    reason?: string;
};
/**
 * Archives completed progress files
 */
export declare function archiveCompletedProgress(): {
    success: boolean;
    archived: number;
};
/**
 * Archives old handoff documents
 */
export declare function archiveHandoffs(): {
    success: boolean;
    archived: number;
};
/**
 * Runs full archive cycle
 */
export declare function runArchiveCycle(): {
    timestamp: string;
    agents: Record<string, {
        archived: boolean;
    }>;
    progress: {
        archived: number;
    };
    handoffs: {
        archived: number;
    };
};
/**
 * Lists archive contents
 */
export declare function listArchiveContents(): {
    months: string[];
    contents: Record<string, {
        memories: string[];
        progress: string[];
        handoffs: string[];
    }>;
};
//# sourceMappingURL=archive-manager.d.ts.map