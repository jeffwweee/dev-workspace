/**
 * Valid progress status values
 *
 * These are the ONLY valid status values for progress files.
 * Orchestrator monitors these values to trigger pipeline actions.
 *
 * IMPORTANT: Use these exact values. Case-sensitive!
 */
/**
 * Work is currently being done
 *
 * Agent is actively working on the task.
 */
export declare const STATUS_IN_PROGRESS = "IN_PROGRESS";
/**
 * Work is done, ready for next stage
 *
 * Orchestrator will:
 * - Create handoff document
 * - Route to next agent in pipeline
 * - Or close pipeline if this is the final stage
 *
 * NOTE: Use "COMPLETE" NOT "COMPLETED"!
 * The orchestrator checks for === 'COMPLETE'
 */
export declare const STATUS_COMPLETE = "COMPLETE";
/**
 * QA found issues requiring revision
 *
 * Used by QA agent when defects are found.
 *
 * Orchestrator will:
 * - Route task back to the previous agent
 * - Notify that revisions are needed
 */
export declare const STATUS_ISSUES_FOUND = "ISSUES_FOUND";
/**
 * Task failed, requires intervention
 *
 * Used when task cannot be completed due to errors, blockers, etc.
 *
 * Orchestrator will:
 * - Notify for human intervention
 * - Stop pipeline advancement
 */
export declare const STATUS_FAILED = "FAILED";
/**
 * Task is blocked, waiting for something
 *
 * Used when work cannot proceed due to dependencies, etc.
 *
 * Orchestrator will:
 * - Log the blockage
 * - Wait for manual intervention
 */
export declare const STATUS_BLOCKED = "BLOCKED";
/**
 * All valid status values
 */
export declare const VALID_STATUSES: readonly ["IN_PROGRESS", "COMPLETE", "ISSUES_FOUND", "FAILED", "BLOCKED"];
/**
 * Status type
 */
export type ProgressStatus = typeof VALID_STATUSES[number];
/**
 * Validates a status value
 */
export declare function isValidStatus(status: string): status is ProgressStatus;
/**
 * Gets the next action for a given status
 */
export declare function getStatusAction(status: ProgressStatus): string;
/**
 * Returns the current pipeline version string
 */
export declare function getPipelineVersion(): string;
/**
 * Returns the current pipeline status
 */
export declare function getPipelineStatus(): string;
/**
 * Returns the current timestamp in ISO format
 */
export declare function getPipelineTimestamp(): string;
/**
 * Test function for backend workflow verification
 */
export declare function getTestMessage(): string;
//# sourceMappingURL=status-constants.d.ts.map