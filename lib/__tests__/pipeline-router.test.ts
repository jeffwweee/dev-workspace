import { routeTask, advanceToNextStage, getNextAgent, getStageInfo, needsReviewBeforeAdvance } from '../pipeline-router';

describe('pipeline-router', () => {
  test('routeTask returns first stage', () => {
    const result = routeTask({ workflow: 'default' });
    expect(result.success).toBe(true);
    expect(result.entryStage).toBe('backend');
  });

  test('getNextAgent returns correct agent', () => {
    expect(getNextAgent('backend')).toBe('review-git');
    expect(getNextAgent('review-git')).toBe('frontend');
    expect(getNextAgent('qa')).toBeNull();
  });

  test('getStageInfo returns correct info', () => {
    const info = getStageInfo('backend');
    expect(info.isFirst).toBe(true);
    expect(info.isLast).toBe(false);
    expect(info.next).toBe('review-git');
  });

  test('needsReviewBeforeAdvance returns true for backend', () => {
    expect(needsReviewBeforeAdvance('backend')).toBe(true);
  });

  test('advanceToNextStage blocks low confidence', () => {
    const result = advanceToNextStage('TASK-001', 'review-git', {
      confidence: 0.5,
      workflow: 'default'
    });
    expect(result.success).toBe(false);
    expect(result.reason).toBe('confidence_below_threshold');
  });
});
