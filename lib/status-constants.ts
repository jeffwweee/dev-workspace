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
export const STATUS_IN_PROGRESS = 'IN_PROGRESS';

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
export const STATUS_COMPLETE = 'COMPLETE';

/**
 * QA found issues requiring revision
 *
 * Used by QA agent when defects are found.
 *
 * Orchestrator will:
 * - Route task back to the previous agent
 * - Notify that revisions are needed
 */
export const STATUS_ISSUES_FOUND = 'ISSUES_FOUND';

/**
 * Task failed, requires intervention
 *
 * Used when task cannot be completed due to errors, blockers, etc.
 *
 * Orchestrator will:
 * - Notify for human intervention
 * - Stop pipeline advancement
 */
export const STATUS_FAILED = 'FAILED';

/**
 * Task is blocked, waiting for something
 *
 * Used when work cannot proceed due to dependencies, etc.
 *
 * Orchestrator will:
 * - Log the blockage
 * - Wait for manual intervention
 */
export const STATUS_BLOCKED = 'BLOCKED';

/**
 * All valid status values
 */
export const VALID_STATUSES = [
  STATUS_IN_PROGRESS,
  STATUS_COMPLETE,
  STATUS_ISSUES_FOUND,
  STATUS_FAILED,
  STATUS_BLOCKED,
] as const;

/**
 * Status type
 */
export type ProgressStatus = typeof VALID_STATUSES[number];

/**
 * Validates a status value
 */
export function isValidStatus(status: string): status is ProgressStatus {
  return VALID_STATUSES.includes(status as ProgressStatus);
}

/**
 * Gets the next action for a given status
 */
export function getStatusAction(status: ProgressStatus): string {
  switch (status) {
    case STATUS_IN_PROGRESS:
      return 'Continue working';
    case STATUS_COMPLETE:
      return 'Route to next agent or close pipeline';
    case STATUS_ISSUES_FOUND:
      return 'Route back to previous agent for revision';
    case STATUS_FAILED:
      return 'Notify for intervention, stop pipeline';
    case STATUS_BLOCKED:
      return 'Log blockage, wait for intervention';
    default:
      return 'Unknown status';
  }
}

/**
 * Returns the current pipeline version string
 */
export function getPipelineVersion(): string {
  return '2.0.0';
}

/**
 * Returns the current pipeline status
 */
export function getPipelineStatus(): string {
  return 'operational';
}

/**
 * Returns the current timestamp in ISO format
 */
export function getPipelineTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Test function for backend workflow verification
 */
export function getTestMessage(): string {
  return 'Backend workflow test successful!';
}
