import { type WorktreeInfo } from './worktree.js';
export interface ClaimResult {
    success: boolean;
    error?: string;
    message?: string;
    lock?: {
        lockId: string;
        projectId?: string;
        taskId?: string;
        expiresAt: string;
    };
    worktree?: WorktreeInfo;
    conflictingLock?: {
        lockId: string;
        ownerId: string;
        expiresAt: string;
    };
}
export declare function claim(options: {
    project?: string;
    task?: string;
    owner?: string;
    ttl?: string;
    session?: string;
    noWorktree?: boolean;
}): Promise<ClaimResult>;
export declare function release(options: {
    lock?: string;
    all?: boolean;
    owner?: string;
    session?: string;
}): Promise<Record<string, unknown>>;
export declare function heartbeat(options: {
    owner?: string;
    lock?: string;
    session?: string;
}): Promise<Record<string, unknown>>;
export declare function cleanupLocks(options: {
    force?: boolean;
}): Promise<Record<string, unknown>>;
//# sourceMappingURL=lock.d.ts.map