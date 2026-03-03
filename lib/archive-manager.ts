import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { loadConfig } from './orchestration-config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STATE_DIR = path.join(__dirname, '..', 'state');
const MEMORY_DIR = path.join(STATE_DIR, 'memory');
const PROGRESS_DIR = path.join(STATE_DIR, 'progress');
const LOG_DIR = path.join(STATE_DIR, 'log');

/**
 * Checks if archiving is needed
 */
export function needsArchiving(filePath: string): { needed: boolean; reason?: string } {
  if (!fs.existsSync(filePath)) {
    return { needed: false, reason: 'file_not_found' };
  }

  const config = loadConfig();
  const stats = fs.statSync(filePath);
  const content = fs.readFileSync(filePath, 'utf-8');

  const sizeKB = stats.size / 1024;
  if (sizeKB > config.archiving.max_file_size_kb) {
    return { needed: true, reason: 'size_exceeded' };
  }

  const taskMatches = content.match(/(TASK-|TG3-|RSS-)\d+/g);
  if (taskMatches && taskMatches.length > config.archiving.max_task_count) {
    return { needed: true, reason: 'task_count_exceeded' };
  }

  return { needed: false };
}

/**
 * Archives a memory file
 */
export function archiveMemoryFile(agent: string): { success: boolean; archived: boolean; archivePath?: string; reason?: string } {
  const sourcePath = path.join(MEMORY_DIR, `${agent}.md`);

  if (!fs.existsSync(sourcePath)) {
    return { success: false, archived: false, reason: 'file_not_found' };
  }

  const check = needsArchiving(sourcePath);
  if (!check.needed) {
    return { success: true, archived: false, reason: 'not_needed' };
  }

  const date = new Date();
  const monthDir = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const archiveSubDir = path.join(LOG_DIR, monthDir);

  if (!fs.existsSync(archiveSubDir)) {
    fs.mkdirSync(archiveSubDir, { recursive: true });
  }

  const dateStr = date.toISOString().split('T')[0];
  const archivePath = path.join(archiveSubDir, `${agent}-${dateStr}.md`);

  fs.copyFileSync(sourcePath, archivePath);

  // Truncate original
  truncateMemoryFile(sourcePath, agent);

  return { success: true, archived: true, archivePath };
}

/**
 * Truncates memory file
 */
function truncateMemoryFile(filePath: string, agent: string): void {
  const header = `# ${agent} Agent Memory

## Essential Context
<!-- Preserved context -->

## Learned Patterns
*Archived. See log/ directory for history.*

## Recent Tasks
*Archived. See log/ directory for history.*

## Error Resolutions
*Archived. See log/ directory for history.*
`;

  fs.writeFileSync(filePath, header);
}

/**
 * Archives completed progress files
 */
export function archiveCompletedProgress(): { success: boolean; archived: number } {
  if (!fs.existsSync(PROGRESS_DIR)) {
    return { success: true, archived: 0 };
  }

  const files = fs.readdirSync(PROGRESS_DIR).filter(f => f.endsWith('.md') && !f.startsWith('HANDOFF'));
  const date = new Date();
  const monthDir = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const archiveSubDir = path.join(LOG_DIR, monthDir, 'progress');

  let archived = 0;

  for (const file of files) {
    const filePath = path.join(PROGRESS_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    if (content.includes('**Status:** COMPLETE')) {
      if (!fs.existsSync(archiveSubDir)) {
        fs.mkdirSync(archiveSubDir, { recursive: true });
      }

      const archivePath = path.join(archiveSubDir, file);
      fs.copyFileSync(filePath, archivePath);
      fs.unlinkSync(filePath);
      archived++;
    }
  }

  return { success: true, archived };
}

/**
 * Archives old handoff documents
 */
export function archiveHandoffs(): { success: boolean; archived: number } {
  if (!fs.existsSync(PROGRESS_DIR)) {
    return { success: true, archived: 0 };
  }

  const files = fs.readdirSync(PROGRESS_DIR).filter(f => f.startsWith('HANDOFF_'));
  const date = new Date();
  const monthDir = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const archiveSubDir = path.join(LOG_DIR, monthDir, 'handoffs');

  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days
  let archived = 0;

  for (const file of files) {
    const filePath = path.join(PROGRESS_DIR, file);
    const stats = fs.statSync(filePath);

    if (stats.mtimeMs < cutoff) {
      if (!fs.existsSync(archiveSubDir)) {
        fs.mkdirSync(archiveSubDir, { recursive: true });
      }

      const archivePath = path.join(archiveSubDir, file);
      fs.copyFileSync(filePath, archivePath);
      fs.unlinkSync(filePath);
      archived++;
    }
  }

  return { success: true, archived };
}

/**
 * Runs full archive cycle
 */
export function runArchiveCycle(): { timestamp: string; agents: Record<string, { archived: boolean }>; progress: { archived: number }; handoffs: { archived: number } } {
  const agents = ['backend', 'frontend', 'qa', 'review-git'];
  const results: Record<string, { archived: boolean }> = {};

  for (const agent of agents) {
    const result = archiveMemoryFile(agent);
    results[agent] = { archived: result.archived };
  }

  const progressResult = archiveCompletedProgress();
  const handoffsResult = archiveHandoffs();

  return {
    timestamp: new Date().toISOString(),
    agents: results,
    progress: { archived: progressResult.archived },
    handoffs: { archived: handoffsResult.archived }
  };
}

/**
 * Lists archive contents
 */
export function listArchiveContents(): { months: string[]; contents: Record<string, { memories: string[]; progress: string[]; handoffs: string[] }> } {
  if (!fs.existsSync(LOG_DIR)) {
    return { months: [], contents: {} };
  }

  const months = fs.readdirSync(LOG_DIR).filter(d => fs.statSync(path.join(LOG_DIR, d)).isDirectory());
  const contents: Record<string, { memories: string[]; progress: string[]; handoffs: string[] }> = {};

  for (const month of months) {
    const monthPath = path.join(LOG_DIR, month);
    contents[month] = { memories: [], progress: [], handoffs: [] };

    const files = fs.readdirSync(monthPath);
    for (const file of files) {
      const filePath = path.join(monthPath, file);
      if (fs.statSync(filePath).isDirectory()) {
        const subFiles = fs.readdirSync(filePath);
        for (const subFile of subFiles) {
          contents[month][file as keyof typeof contents[typeof month]].push(subFile);
        }
      } else {
        contents[month].memories.push(file);
      }
    }
  }

  return { months, contents };
}
