import {
  readAgentMemory,
  appendAgentMemory,
  readPrimaryMemory,
  createProgressFile,
  readProgressFile,
  updateProgressFile
} from '../memory-manager';
import * as fs from 'fs';
import * as path from 'path';

const TEST_AGENT = 'test-memory-agent';
const TEST_TASK = 'TEST-MEM-001';
const MEMORY_DIR = path.join(__dirname, '..', '..', 'state', 'memory');
const PROGRESS_DIR = path.join(__dirname, '..', '..', 'state', 'progress');

function cleanup() {
  const memPath = path.join(MEMORY_DIR, `${TEST_AGENT}.md`);
  const progPath = path.join(PROGRESS_DIR, `${TEST_TASK}.md`);
  if (fs.existsSync(memPath)) fs.unlinkSync(memPath);
  if (fs.existsSync(progPath)) fs.unlinkSync(progPath);
}

describe('memory-manager', () => {
  afterEach(cleanup);

  test('readAgentMemory returns template for non-existent agent', () => {
    const memory = readAgentMemory(TEST_AGENT);
    expect(memory).toContain('# test-memory-agent Agent Memory');
  });

  test('appendAgentMemory adds content to section', () => {
    appendAgentMemory(TEST_AGENT, 'Learned Patterns', 'Test pattern learned');
    const memory = readAgentMemory(TEST_AGENT);
    expect(memory).toContain('Test pattern learned');
  });

  test('createProgressFile creates file with correct structure', () => {
    createProgressFile(TEST_AGENT, TEST_TASK, { description: 'Test task' });
    const progress = readProgressFile(TEST_AGENT, TEST_TASK);
    expect(progress).not.toBeNull();
    expect(progress?.status).toBe('IN_PROGRESS');
    expect(progress?.agent).toBe(TEST_AGENT);
  });

  test('updateProgressFile updates status', () => {
    createProgressFile(TEST_AGENT, TEST_TASK, { description: 'Test' });
    updateProgressFile(TEST_AGENT, TEST_TASK, { status: 'COMPLETE' });
    const progress = readProgressFile(TEST_AGENT, TEST_TASK);
    expect(progress?.status).toBe('COMPLETE');
  });

  test('readPrimaryMemory returns content', () => {
    const memory = readPrimaryMemory();
    expect(memory).toContain('# Primary Orchestrator Memory');
  });
});
