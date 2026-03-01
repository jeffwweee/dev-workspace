import * as fs from 'fs';
import * as path from 'path';

const PENDING_DIR = path.join(__dirname, '..', 'state', 'pending');

export interface QueueTask {
  id: string;
  description?: string;
  workflow?: string;
  planPath?: string;
  handoffPath?: string;
  priority?: number;
  enqueued_at?: string;
  position?: number;
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
export function readQueue(agent: string): Queue {
  const queuePath = path.join(PENDING_DIR, `${agent}.json`);

  if (!fs.existsSync(queuePath)) {
    return { agent, max_length: 3, tasks: [] };
  }

  return JSON.parse(fs.readFileSync(queuePath, 'utf-8'));
}

/**
 * Writes an agent's queue
 */
export function writeQueue(agent: string, queue: Queue): void {
  const queuePath = path.join(PENDING_DIR, `${agent}.json`);
  fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2));
}

/**
 * Adds a task to an agent's queue
 */
export function enqueueTask(agent: string, task: QueueTask): EnqueueResult {
  const queue = readQueue(agent);

  if (queue.tasks.length >= queue.max_length) {
    return { success: false, reason: 'queue_full', max_length: queue.max_length };
  }

  const position = queue.tasks.length + 1;

  const taskEntry: QueueTask = {
    ...task,
    enqueued_at: new Date().toISOString(),
    position
  };

  queue.tasks.push(taskEntry);
  writeQueue(agent, queue);

  return {
    success: true,
    position,
    estimated_wait_ms: position * 300000 // 5 min per task estimate
  };
}

/**
 * Removes and returns the next task from an agent's queue
 */
export function dequeueTask(agent: string): QueueTask | null {
  const queue = readQueue(agent);

  if (queue.tasks.length === 0) {
    return null;
  }

  const task = queue.tasks.shift();
  writeQueue(agent, queue);

  return task || null;
}

/**
 * Peeks at the next task without removing it
 */
export function peekQueue(agent: string): QueueTask | null {
  const queue = readQueue(agent);
  return queue.tasks.length > 0 ? queue.tasks[0] : null;
}

/**
 * Gets queue length
 */
export function getQueueLength(agent: string): number {
  const queue = readQueue(agent);
  return queue.tasks.length;
}

/**
 * Checks if queue is at capacity
 */
export function isQueueFull(agent: string): boolean {
  const queue = readQueue(agent);
  return queue.tasks.length >= queue.max_length;
}

/**
 * Clears all tasks from an agent's queue
 */
export function clearQueue(agent: string): void {
  writeQueue(agent, { agent, max_length: 3, tasks: [] });
}
