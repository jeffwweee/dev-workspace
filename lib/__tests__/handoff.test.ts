import { createHandoff, saveHandoff, readHandoff, listHandoffs } from '../handoff';
import * as fs from 'fs';
import * as path from 'path';

const TEST_TASK = 'HANDOFF-TEST-001';
const PROGRESS_DIR = path.join(__dirname, '..', '..', 'state', 'progress');

function cleanup() {
  const handoffs = listHandoffs(TEST_TASK);
  for (const h of handoffs) {
    if (fs.existsSync(h)) fs.unlinkSync(h);
  }
}

describe('handoff', () => {
  afterEach(cleanup);

  test('createHandoff generates correct document', () => {
    const handoff = createHandoff({
      from: 'backend',
      to: 'review-git',
      taskId: TEST_TASK,
      status: 'COMPLETE',
      confidence: 0.85,
      summary: 'Implemented feature',
      filesChanged: ['src/auth.ts'],
      learnings: ['Custom auth library']
    });

    expect(handoff).toContain('HANDOFF: backend → review-git');
    expect(handoff).toContain('Status: COMPLETE');
    expect(handoff).toContain('Confidence: 0.85');
    expect(handoff).toContain('src/auth.ts');
  });

  test('saveHandoff writes file', () => {
    const handoff = createHandoff({
      from: 'backend',
      to: 'review-git',
      taskId: TEST_TASK,
      status: 'COMPLETE',
      confidence: 0.8,
      summary: 'Test'
    });

    const savedPath = saveHandoff(handoff, TEST_TASK, 'backend', 'review-git');
    expect(fs.existsSync(savedPath)).toBe(true);
  });

  test('readHandoff parses document', () => {
    const handoff = createHandoff({
      from: 'backend',
      to: 'review-git',
      taskId: TEST_TASK,
      status: 'COMPLETE',
      confidence: 0.85,
      summary: 'Test summary',
      learnings: ['Pattern 1', 'Pattern 2']
    });

    saveHandoff(handoff, TEST_TASK, 'backend', 'review-git');
    const read = readHandoff(TEST_TASK, 'backend', 'review-git');

    expect(read).not.toBeNull();
    expect(read?.status).toBe('COMPLETE');
    expect(read?.confidence).toBe(0.85);
    expect(read?.learnings).toContain('Pattern 1');
  });

  test('listHandoffs finds handoff files', () => {
    const handoff = createHandoff({
      from: 'backend',
      to: 'review-git',
      taskId: TEST_TASK,
      status: 'COMPLETE',
      confidence: 0.8,
      summary: 'Test'
    });

    saveHandoff(handoff, TEST_TASK, 'backend', 'review-git');
    const handoffs = listHandoffs(TEST_TASK);
    expect(handoffs.length).toBe(1);
  });
});
