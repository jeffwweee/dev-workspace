export interface RouteResult {
    success: boolean;
    entryStage?: string;
    pipeline?: string[];
    reviewThreshold?: number;
    reason?: string;
}
export interface AdvanceResult {
    success: boolean;
    complete?: boolean;
    nextAgent?: string;
    handoffPath?: string;
    queuePosition?: number;
    estimatedWait?: number;
    reason?: string;
    confidence?: number;
    threshold?: number;
    suggestion?: string;
}
/**
 * Routes a task through the pipeline
 */
export declare function routeTask(task: {
    workflow?: string;
}): RouteResult;
/**
 * Advances task to next pipeline stage
 */
export declare function advanceToNextStage(taskId: string, currentAgent: string, result: {
    workflow?: string;
    status?: string;
    confidence?: number;
    summary?: string;
    filesChanged?: string[];
    learnings?: string[];
}): AdvanceResult;
/**
 * Gets next agent in pipeline
 */
export declare function getNextAgent(currentAgent: string, workflowName?: string): string | null;
/**
 * Gets pipeline stage info
 */
export declare function getStageInfo(agent: string, workflowName?: string): {
    agent: string;
    index: number;
    total: number;
    isFirst: boolean;
    isLast: boolean;
    previous: string | null;
    next: string | null;
};
/**
 * Checks if review is needed before next stage
 */
export declare function needsReviewBeforeAdvance(currentAgent: string, workflowName?: string): boolean;
//# sourceMappingURL=pipeline-router.d.ts.map