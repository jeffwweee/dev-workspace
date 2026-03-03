import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PENDING_DIR = path.join(__dirname, '..', 'state', 'pending');
/**
 * Reads an agent's queue
 */
export function readQueue(agent) {
    const queuePath = path.join(PENDING_DIR, `${agent}.json`);
    if (!fs.existsSync(queuePath)) {
        return { agent, max_length: 3, tasks: [] };
    }
    return JSON.parse(fs.readFileSync(queuePath, 'utf-8'));
}
/**
 * Writes an agent's queue
 */
export function writeQueue(agent, queue) {
    const queuePath = path.join(PENDING_DIR, `${agent}.json`);
    fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2));
}
/**
 * Adds a task to an agent's queue
 */
export function enqueueTask(agent, task) {
    const queue = readQueue(agent);
    if (queue.tasks.length >= queue.max_length) {
        return { success: false, reason: 'queue_full', max_length: queue.max_length };
    }
    const position = queue.tasks.length + 1;
    const taskEntry = {
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
export function dequeueTask(agent) {
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
export function peekQueue(agent) {
    const queue = readQueue(agent);
    return queue.tasks.length > 0 ? queue.tasks[0] : null;
}
/**
 * Gets queue length
 */
export function getQueueLength(agent) {
    const queue = readQueue(agent);
    return queue.tasks.length;
}
/**
 * Checks if queue is at capacity
 */
export function isQueueFull(agent) {
    const queue = readQueue(agent);
    return queue.tasks.length >= queue.max_length;
}
/**
 * Clears all tasks from an agent's queue
 */
export function clearQueue(agent) {
    writeQueue(agent, { agent, max_length: 3, tasks: [] });
}
//# sourceMappingURL=queue-manager.js.map