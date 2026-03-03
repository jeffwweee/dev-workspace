import { getCoreAgents } from './spawn-agent';
export interface OrchestratorState {
    isRunning: boolean;
    loopCount: number;
    activeTasks: Map<string, {
        agent: string;
        status: string;
        started: string;
        workflow?: string;
    }>;
    lastSync: string | null;
}
/**
 * Initializes the orchestrator
 */
export declare function initialize(): Promise<void>;
/**
 * Main orchestrator loop
 */
export declare function runLoop(): Promise<void>;
/**
 * Submits a new task to the orchestrator
 */
export declare function submitTask(task: {
    id: string;
    description?: string;
    workflow?: string;
    planPath?: string;
    chatId?: number;
}): Promise<{
    success: boolean;
    position?: number;
}>;
/**
 * Stops the orchestrator
 */
export declare function stop(): Promise<void>;
/**
 * Gets orchestrator status
 */
export declare function getStatus(): OrchestratorState & {
    queueLengths: Record<string, number>;
    runningAgents: string[];
};
export { getCoreAgents };
//# sourceMappingURL=orchestrator.d.ts.map