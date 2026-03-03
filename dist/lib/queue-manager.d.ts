export interface QueueTask {
    id: string;
    description?: string;
    workflow?: string;
    planPath?: string;
    handoffPath?: string;
    handoffFrom?: string;
    priority?: number;
    enqueued_at?: string;
    position?: number;
    chatId?: number;
}
export interface Queue {
    agent: string;
    max_length: number;
    tasks: QueueTask[];
}
export interface EnqueueResult {
    success: boolean;
    position?: number;
    estimated_wait_ms?: number;
    reason?: string;
    max_length?: number;
}
/**
 * Reads an agent's queue
 */
export declare function readQueue(agent: string): Queue;
/**
 * Writes an agent's queue
 */
export declare function writeQueue(agent: string, queue: Queue): void;
/**
 * Adds a task to an agent's queue
 */
export declare function enqueueTask(agent: string, task: QueueTask): EnqueueResult;
/**
 * Removes and returns the next task from an agent's queue
 */
export declare function dequeueTask(agent: string): QueueTask | null;
/**
 * Peeks at the next task without removing it
 */
export declare function peekQueue(agent: string): QueueTask | null;
/**
 * Gets queue length
 */
export declare function getQueueLength(agent: string): number;
/**
 * Checks if queue is at capacity
 */
export declare function isQueueFull(agent: string): boolean;
/**
 * Clears all tasks from an agent's queue
 */
export declare function clearQueue(agent: string): void;
//# sourceMappingURL=queue-manager.d.ts.map