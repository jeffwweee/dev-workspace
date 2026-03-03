import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MEMORY_DIR = path.join(__dirname, '..', 'state', 'memory');

export interface Learning {
  type: 'pattern' | 'resolution';
  agent: string;
  content: string;
  extractedAt: string;
}

/**
 * Extracts learnings from agent memory file
 */
export function extractLearnings(agent: string): Learning[] {
  const memoryPath = path.join(MEMORY_DIR, `${agent}.md`);

  if (!fs.existsSync(memoryPath)) {
    return [];
  }

  const content = fs.readFileSync(memoryPath, 'utf-8');
  const learnings: Learning[] = [];

  // Extract learned patterns section
  const patternsMatch = content.match(/## Learned Patterns\n([\s\S]*?)(?=## |$)/i);
  if (patternsMatch) {
    const patterns = patternsMatch[1]
      .trim()
      .split('\n')
      .filter(l => l.startsWith('- ') || l.startsWith('* '))
      .map(l => l.replace(/^[-*] /, ''));

    for (const pattern of patterns) {
      if (pattern.length > 10) {
        learnings.push({
          type: 'pattern',
          agent,
          content: pattern,
          extractedAt: new Date().toISOString()
        });
      }
    }
  }

  // Extract error resolutions
  const errorsMatch = content.match(/## Error Resolutions\n([\s\S]*?)(?=## |$)/i);
  if (errorsMatch) {
    const resolutions = errorsMatch[1]
      .trim()
      .split('\n')
      .filter(l => l.startsWith('- ') || l.startsWith('* '))
      .map(l => l.replace(/^[-*] /, ''));

    for (const resolution of resolutions) {
      if (resolution.length > 10) {
        learnings.push({
          type: 'resolution',
          agent,
          content: resolution,
          extractedAt: new Date().toISOString()
        });
      }
    }
  }

  return learnings;
}

/**
 * Syncs learnings to Redis evolution registry
 */
export function syncToEvolutionRegistry(agent: string): { success: boolean; synced: number; total: number } {
  const learnings = extractLearnings(agent);

  if (learnings.length === 0) {
    return { success: true, synced: 0, total: 0 };
  }

  // Check if Redis is available
  try {
    execSync('redis-cli ping', { stdio: 'pipe' });
  } catch {
    console.log('[Learning] Redis not available, skipping sync');
    return { success: false, synced: 0, total: learnings.length };
  }

  let synced = 0;

  for (const learning of learnings) {
    try {
      const geneId = `gene:${agent}:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`;

      const geneData = JSON.stringify({
        id: geneId,
        source: agent,
        type: learning.type,
        content: learning.content,
        extractedAt: learning.extractedAt,
        syncedAt: new Date().toISOString()
      });

      execSync(`redis-cli SET "${geneId}" '${geneData.replace(/'/g, "\\'")}'`);
      execSync(`redis-cli SADD "genes:${agent}" "${geneId}"`);

      synced++;
    } catch (error) {
      console.error(`[Learning] Failed to sync learning`);
    }
  }

  return { success: true, synced, total: learnings.length };
}

/**
 * Syncs all agents' learnings
 */
export function syncAllAgents(): { success: boolean; agents: Record<string, { synced: number; total: number }>; totalSynced: number } {
  const agents = ['backend', 'frontend', 'qa', 'review-git'];
  const results: Record<string, { synced: number; total: number }> = {};

  for (const agent of agents) {
    results[agent] = syncToEvolutionRegistry(agent);
  }

  const totalSynced = Object.values(results).reduce((sum, r) => sum + r.synced, 0);

  return { success: true, agents: results, totalSynced };
}
