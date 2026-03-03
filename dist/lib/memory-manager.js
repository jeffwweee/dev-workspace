import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
// Import status constants for internal use and re-export
import { STATUS_IN_PROGRESS, STATUS_COMPLETE, STATUS_ISSUES_FOUND, STATUS_FAILED, STATUS_BLOCKED, isValidStatus, getStatusAction } from './status-constants.js';
// Re-export for convenience
export { STATUS_IN_PROGRESS, STATUS_COMPLETE, STATUS_ISSUES_FOUND, STATUS_FAILED, STATUS_BLOCKED, isValidStatus, getStatusAction };
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATE_DIR = path.join(__dirname, '..', 'state');
const MEMORY_DIR = path.join(STATE_DIR, 'memory');
const PROGRESS_DIR = path.join(STATE_DIR, 'progress');
const LOG_DIR = path.join(STATE_DIR, 'log');
/**
 * Reads an agent's memory file
 */
export function readAgentMemory(agent) {
    const memoryPath = path.join(MEMORY_DIR, `${agent}.md`);
    if (!fs.existsSync(memoryPath)) {
        return `# ${agent} Agent Memory\n\n## Essential Context\n\n## Learned Patterns\n\n## Recent Tasks\n\n## Error Resolutions\n`;
    }
    return fs.readFileSync(memoryPath, 'utf-8');
}
/**
 * Appends to an agent's memory file
 */
export function appendAgentMemory(agent, section, content) {
    const memoryPath = path.join(MEMORY_DIR, `${agent}.md`);
    let memory = readAgentMemory(agent);
    const timestamp = new Date().toISOString().split('T')[0];
    const entry = `\n\n### ${timestamp}\n${content}`;
    const sectionHeader = `## ${section}`;
    if (!memory.includes(sectionHeader)) {
        memory += `\n\n${sectionHeader}${entry}`;
    }
    else {
        // Find section and append
        const lines = memory.split('\n');
        const sectionIndex = lines.findIndex(l => l.trim() === sectionHeader);
        if (sectionIndex !== -1) {
            let nextSectionIndex = lines.slice(sectionIndex + 1).findIndex(l => l.startsWith('## '));
            if (nextSectionIndex === -1) {
                nextSectionIndex = lines.length;
            }
            else {
                nextSectionIndex += sectionIndex + 1;
            }
            lines.splice(nextSectionIndex, 0, entry);
            memory = lines.join('\n');
        }
    }
    fs.writeFileSync(memoryPath, memory);
}
/**
 * Reads primary orchestrator memory
 */
export function readPrimaryMemory() {
    const memoryPath = path.join(STATE_DIR, 'primary.md');
    if (!fs.existsSync(memoryPath)) {
        return `# Primary Orchestrator Memory\n\n## Essential Context\n\n## Active Tasks\n\n## Recent Completions\n\n## Learnings\n\n## Metrics\n`;
    }
    return fs.readFileSync(memoryPath, 'utf-8');
}
/**
 * Creates a progress file for an agent's task
 */
export function createProgressFile(agent, taskId, taskInfo) {
    const progressPath = path.join(PROGRESS_DIR, `${taskId}.md`);
    const content = `# Progress: ${taskId}

**Agent:** ${agent}
**Status:** ${STATUS_IN_PROGRESS}
**Started:** ${new Date().toISOString()}

## Task Description
${taskInfo.description || 'No description'}

## Progress Log
### ${new Date().toISOString()}
Task started

## Files Changed
<!-- Auto-populated as work progresses -->

## Blockers
<!-- Any blockers encountered -->
`;
    fs.writeFileSync(progressPath, content);
}
/**
 * Updates a progress file
 */
export function updateProgressFile(agent, taskId, updates) {
    const progressPath = path.join(PROGRESS_DIR, `${taskId}.md`);
    if (!fs.existsSync(progressPath)) {
        return false;
    }
    let content = fs.readFileSync(progressPath, 'utf-8');
    if (updates.status) {
        // Validate status
        if (!isValidStatus(updates.status)) {
            console.error(`[MemoryManager] Invalid status: ${updates.status}. Valid values: ${STATUS_IN_PROGRESS}, ${STATUS_COMPLETE}, ${STATUS_ISSUES_FOUND}, ${STATUS_FAILED}, ${STATUS_BLOCKED}`);
            return false;
        }
        content = content.replace(/\*\*Status:\*\* \w+/, `**Status:** ${updates.status}`);
    }
    if (updates.log) {
        const timestamp = new Date().toISOString();
        content += `\n\n### ${timestamp}\n${updates.log}`;
    }
    fs.writeFileSync(progressPath, content);
    return true;
}
/**
 * Reads a progress file
 */
export function readProgressFile(agent, taskId) {
    const progressPath = path.join(PROGRESS_DIR, `${taskId}.md`);
    if (!fs.existsSync(progressPath)) {
        return null;
    }
    const content = fs.readFileSync(progressPath, 'utf-8');
    const statusMatch = content.match(/\*\*Status:\*\* (\w+)/);
    const startedMatch = content.match(/\*\*Started:\*\* (.+)/);
    return {
        agent,
        taskId,
        status: statusMatch ? statusMatch[1] : 'UNKNOWN',
        started: startedMatch ? startedMatch[1].trim() : null,
        raw: content
    };
}
//# sourceMappingURL=memory-manager.js.map