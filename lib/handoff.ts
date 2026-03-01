import * as fs from 'fs';
import * as path from 'path';

const PROGRESS_DIR = path.join(__dirname, '..', 'state', 'progress');

export interface HandoffOptions {
  from: string;
  to: string;
  taskId: string;
  status: 'COMPLETE' | 'BLOCKED' | 'FAILED';
  confidence: number;
  summary: string;
  filesChanged?: string[];
  learnings?: string[];
  blockers?: string;
  recommendations?: string[];
}

export interface HandoffInfo {
  taskId: string;
  from: string;
  to: string;
  status: string;
  confidence: number;
  summary: string;
  learnings: string[];
  raw: string;
  path: string;
}

/**
 * Creates a handoff document
 */
export function createHandoff(options: HandoffOptions): string {
  const {
    from,
    to,
    taskId,
    status,
    confidence,
    summary,
    filesChanged = [],
    learnings = [],
    blockers = 'None',
    recommendations = []
  } = options;

  return `# HANDOFF: ${from} → ${to}

## Task: ${taskId}
## Status: ${status}
## Confidence: ${confidence}

## Summary
${summary}

## Files Changed
${filesChanged.length > 0 ? filesChanged.map(f => `- ${f}`).join('\n') : '- None'}

## Learnings for Next Agent
${learnings.length > 0 ? learnings.map(l => `- ${l}`).join('\n') : '- None'}

## Blockers (if any)
${blockers}

## Recommendations for Next Agent
${recommendations.length > 0 ? recommendations.map(r => `- ${r}`).join('\n') : '- None'}

---
*Generated at: ${new Date().toISOString()}*
`;
}

/**
 * Saves a handoff document
 */
export function saveHandoff(handoff: string, taskId: string, from: string, to: string): string {
  const handoffPath = path.join(PROGRESS_DIR, `HANDOFF_${taskId}_${from}_to_${to}.md`);
  fs.writeFileSync(handoffPath, handoff);
  return handoffPath;
}

/**
 * Reads a handoff document
 */
export function readHandoff(taskId: string, from: string, to: string): HandoffInfo | null {
  const handoffPath = path.join(PROGRESS_DIR, `HANDOFF_${taskId}_${from}_to_${to}.md`);

  if (!fs.existsSync(handoffPath)) {
    return null;
  }

  const content = fs.readFileSync(handoffPath, 'utf-8');

  const statusMatch = content.match(/## Status: (\w+)/);
  const confidenceMatch = content.match(/## Confidence: ([\d.]+)/);
  const summaryMatch = content.match(/## Summary\n([\s\S]*?)(?=## Files Changed)/);
  const learningsMatch = content.match(/## Learnings for Next Agent\n([\s\S]*?)(?=## Blockers)/);

  return {
    taskId,
    from,
    to,
    status: statusMatch ? statusMatch[1] : 'UNKNOWN',
    confidence: confidenceMatch ? parseFloat(confidenceMatch[1]) : 0,
    summary: summaryMatch ? summaryMatch[1].trim() : '',
    learnings: learningsMatch
      ? learningsMatch[1].trim().split('\n').filter(l => l.startsWith('- ')).map(l => l.slice(2))
      : [],
    raw: content,
    path: handoffPath
  };
}

/**
 * Lists all handoff documents for a task
 */
export function listHandoffs(taskId: string): string[] {
  if (!fs.existsSync(PROGRESS_DIR)) {
    return [];
  }

  return fs.readdirSync(PROGRESS_DIR)
    .filter(f => f.startsWith(`HANDOFF_${taskId}_`))
    .map(f => path.join(PROGRESS_DIR, f));
}
