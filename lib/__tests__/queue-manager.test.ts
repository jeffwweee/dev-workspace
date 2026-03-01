import {
  enqueueTask,
  dequeueTask,
  peekQueue,
  getQueueLength,
  isQueueFull,
  clearQueue
} from '../queue-manager';
import * as fs from 'fs';
import * as path from 'path';

const TEST_AGENT = 'test-queue';
const PENDING_DIR = path.join(__dirname, '..', '..', 'state', 'pending');
const TEST_QUEUE_PATH = path.join(PENDING_DIR, `${TEST_AGENT}.json`);

function cleanup() {
  if (fs.existsSync(TEST_QUEUE_PATH)) {
    fs.unlinkSync(TEST_QUEUE_PATH);
  }
}

describe('queue-manager', () => {
  afterEach(cleanup);

  test('enqueueTask adds task to queue', () => {
    const result = enqueueTask(TEST_AGENT, { id: 'TASK-001' });
    expect(result.success).toBe(true);
    expect(result.position).toBe(1);
  });

  test('peekQueue returns first task without removing', () => {
    enqueueTask(TEST_AGENT, { id: 'TASK-001' });
    enqueueTask(TEST_AGENT, { id: 'TASK-002' });

    const task = peekQueue(TEST_AGENT);
    expect(task?.id).toBe('TASK-001');
    expect(getQueueLength(TEST_AGENT)).toBe(2);
  });

  test('dequeueTask removes and returns first task', () => {
    enqueueTask(TEST_AGENT, { id: 'TASK-001' });
    enqueueTask(TEST_AGENT, { id: 'TASK-002' });

    const task = dequeueTask(TEST_AGENT);
    expect(task?.id).toBe('TASK-001');
    expect(getQueueLength(TEST_AGENT)).toBe(1);
  });

  test('isQueueFull returns false when under limit', () => {
    enqueueTask(TEST_AGENT, { id: 'TASK-001' });
    expect(isQueueFull(TEST_AGENT)).toBe(false);
  });

  test('isQueueFull returns true when at limit', () => {
    enqueueTask(TEST_AGENT, { id: 'TASK-001' });
    enqueueTask(TEST_AGENT, { id: 'TASK-002' });
    enqueueTask(TEST_AGENT, { id: 'TASK-003' });
    expect(isQueueFull(TEST_AGENT)).toBe(true);
  });

  test('enqueueTask fails when queue is full', () => {
    enqueueTask(TEST_AGENT, { id: 'TASK-001' });
    enqueueTask(TEST_AGENT, { id: 'TASK-002' });
    enqueueTask(TEST_AGENT, { id: 'TASK-003' });

    const result = enqueueTask(TEST_AGENT, { id: 'TASK-004' });
    expect(result.success).toBe(false);
    expect(result.reason).toBe('queue_full');
  });

  test('clearQueue removes all tasks', () => {
    enqueueTask(TEST_AGENT, { id: 'TASK-001' });
    clearQueue(TEST_AGENT);
    expect(getQueueLength(TEST_AGENT)).toBe(0);
  });
});
