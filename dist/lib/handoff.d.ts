export interface HandoffOptions {
    from: string;
    to: string;
    taskId: string;
    status: 'IN_PROGRESS' | 'COMPLETE' | 'ISSUES_FOUND' | 'BLOCKED' | 'FAILED';
    confidence: number;
    summary: string;
    filesChanged?: string[];
    learnings?: string[];
    blockers?: string;
    recommendations?: string[];
}
export interface HandoffInfo {
    taskId: string;
    from: string;
    to: string;
    status: string;
    confidence: number;
    summary: string;
    learnings: string[];
    raw: string;
    path: string;
}
/**
 * Creates a handoff document
 */
export declare function createHandoff(options: HandoffOptions): string;
/**
 * Saves a handoff document
 */
export declare function saveHandoff(handoff: string, taskId: string, from: string, to: string): string;
/**
 * Reads a handoff document
 */
export declare function readHandoff(taskId: string, from: string, to: string): HandoffInfo | null;
/**
 * Lists all handoff documents for a task
 */
export declare function listHandoffs(taskId: string): string[];
//# sourceMappingURL=handoff.d.ts.map