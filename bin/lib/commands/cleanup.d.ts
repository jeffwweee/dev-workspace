export interface CleanupResult {
    success: boolean;
    sessions: {
        expired: number;
        ended: string[];
    };
    locks: {
        expired: number;
    };
    worktrees: {
        orphaned: Array<{
            path: string;
            projectName: string;
            taskId: string;
        }>;
    };
    message: string;
}
/**
 * Clean up expired sessions, locks, and find orphaned worktrees
 */
export declare function cleanup(options: {
    sessionTtl?: number;
    dryRun?: boolean;
}): Promise<CleanupResult>;
/**
 * Prune orphaned worktrees
 */
export declare function pruneWorktrees(options: {
    dryRun?: boolean;
}): Promise<{
    success: boolean;
    removed: Array<{
        path: string;
        projectName: string;
        taskId: string;
    }>;
    failed: Array<{
        path: string;
        error: string;
    }>;
    message: string;
}>;
//# sourceMappingURL=cleanup.d.ts.map