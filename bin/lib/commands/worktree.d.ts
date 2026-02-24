export interface WorktreeInfo {
    path: string;
    branch: string;
    taskId: string;
    projectName: string;
    exists: boolean;
}
/**
 * Create a worktree for a task
 */
export declare function createWorktree(projectPath: string, projectName: string, taskId: string, branchName?: string): WorktreeInfo;
/**
 * Remove a worktree
 */
export declare function removeWorktree(projectPath: string, worktreePath: string, force?: boolean): {
    success: boolean;
    message: string;
};
/**
 * List all worktrees for a project
 */
export declare function listWorktrees(projectPath: string): WorktreeInfo[];
/**
 * Check if worktree has uncommitted changes
 */
export declare function hasUncommittedChanges(worktreePath: string): boolean;
/**
 * Get worktree info by task ID
 */
export declare function getWorktreeByTask(projectPath: string, projectName: string, taskId: string): WorktreeInfo | null;
export declare function worktreeList(projectName?: string): Promise<{
    success: boolean;
    worktrees: WorktreeInfo[];
    message?: string;
}>;
export declare function worktreeCreate(projectName: string, taskId: string, branch?: string): Promise<{
    success: boolean;
    worktree?: WorktreeInfo;
    error?: string;
    message?: string;
}>;
export declare function worktreeRemove(projectName: string, taskId: string, force?: boolean): Promise<{
    success: boolean;
    error?: string;
    message?: string;
}>;
//# sourceMappingURL=worktree.d.ts.map