import { getWorkflow } from './orchestration-config';
import { enqueueTask } from './queue-manager';
import { createHandoff, saveHandoff } from './handoff';

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
export function routeTask(task: { workflow?: string }): RouteResult {
  const workflow = getWorkflow(task.workflow || 'default');
  const firstStage = workflow.pipeline[0];

  if (!firstStage) {
    return { success: false, reason: 'empty_pipeline' };
  }

  return {
    success: true,
    entryStage: firstStage,
    pipeline: workflow.pipeline,
    reviewThreshold: workflow.review_threshold
  };
}

/**
 * Advances task to next pipeline stage
 */
export function advanceToNextStage(
  taskId: string,
  currentAgent: string,
  result: { workflow?: string; status?: string; confidence?: number; summary?: string; filesChanged?: string[]; learnings?: string[] }
): AdvanceResult {
  const workflow = getWorkflow(result.workflow || 'default');
  const pipeline = workflow.pipeline;
  const currentIndex = pipeline.indexOf(currentAgent);

  if (currentIndex === -1) {
    return { success: false, reason: 'agent_not_in_pipeline' };
  }

  if (currentIndex === pipeline.length - 1) {
    return { success: true, complete: true };
  }

  const nextAgent = pipeline[currentIndex + 1];

  // Check confidence threshold if coming from review-git
  if (currentAgent === 'review-git' && result.confidence !== undefined) {
    if (result.confidence < workflow.review_threshold) {
      return {
        success: false,
        reason: 'confidence_below_threshold',
        confidence: result.confidence,
        threshold: workflow.review_threshold,
        suggestion: 'block_and_notify'
      };
    }
  }

  // Create handoff
  const handoff = createHandoff({
    from: currentAgent,
    to: nextAgent,
    taskId,
    status: result.status === 'FAILED' ? 'FAILED' : 'COMPLETE',
    confidence: result.confidence || 0.8,
    summary: result.summary || `Completed by ${currentAgent}`,
    filesChanged: result.filesChanged,
    learnings: result.learnings
  });

  const handoffPath = saveHandoff(handoff, taskId, currentAgent, nextAgent);

  // Enqueue for next agent
  const enqueueResult = enqueueTask(nextAgent, {
    id: taskId,
    handoffFrom: currentAgent,
    handoffPath,
    workflow: result.workflow
  });

  return {
    success: enqueueResult.success,
    nextAgent,
    handoffPath,
    queuePosition: enqueueResult.position,
    estimatedWait: enqueueResult.estimated_wait_ms
  };
}

/**
 * Gets next agent in pipeline
 */
export function getNextAgent(currentAgent: string, workflowName = 'default'): string | null {
  const workflow = getWorkflow(workflowName);
  const pipeline = workflow.pipeline;
  const currentIndex = pipeline.indexOf(currentAgent);

  if (currentIndex === -1 || currentIndex === pipeline.length - 1) {
    return null;
  }

  return pipeline[currentIndex + 1];
}

/**
 * Gets pipeline stage info
 */
export function getStageInfo(agent: string, workflowName = 'default'): {
  agent: string;
  index: number;
  total: number;
  isFirst: boolean;
  isLast: boolean;
  previous: string | null;
  next: string | null;
} {
  const workflow = getWorkflow(workflowName);
  const pipeline = workflow.pipeline;
  const index = pipeline.indexOf(agent);

  return {
    agent,
    index,
    total: pipeline.length,
    isFirst: index === 0,
    isLast: index === pipeline.length - 1,
    previous: index > 0 ? pipeline[index - 1] : null,
    next: index < pipeline.length - 1 ? pipeline[index + 1] : null
  };
}

/**
 * Checks if review is needed before next stage
 */
export function needsReviewBeforeAdvance(currentAgent: string, workflowName = 'default'): boolean {
  const nextAgent = getNextAgent(currentAgent, workflowName);
  return nextAgent === 'review-git';
}
