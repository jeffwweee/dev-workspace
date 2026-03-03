import { STATUS_IN_PROGRESS, STATUS_COMPLETE, STATUS_ISSUES_FOUND, STATUS_FAILED, STATUS_BLOCKED, type ProgressStatus, isValidStatus, getStatusAction } from './status-constants.js';
export { STATUS_IN_PROGRESS, STATUS_COMPLETE, STATUS_ISSUES_FOUND, STATUS_FAILED, STATUS_BLOCKED, type ProgressStatus, isValidStatus, getStatusAction };
export interface ProgressInfo {
    agent: string;
    taskId: string;
    status: string;
    started: string | null;
    raw: string;
}
/**
 * Reads an agent's memory file
 */
export declare function readAgentMemory(agent: string): string;
/**
 * Appends to an agent's memory file
 */
export declare function appendAgentMemory(agent: string, section: string, content: string): void;
/**
 * Reads primary orchestrator memory
 */
export declare function readPrimaryMemory(): string;
/**
 * Creates a progress file for an agent's task
 */
export declare function createProgressFile(agent: string, taskId: string, taskInfo: {
    description?: string;
}): void;
/**
 * Updates a progress file
 */
export declare function updateProgressFile(agent: string, taskId: string, updates: {
    status?: string;
    log?: string;
}): boolean;
/**
 * Reads a progress file
 */
export declare function readProgressFile(agent: string, taskId: string): ProgressInfo | null;
//# sourceMappingURL=memory-manager.d.ts.map