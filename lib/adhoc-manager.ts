import { spawnAgent, killAgent, isAgentRunning, listAgentSessions } from './spawn-agent';
import { getLimits } from './orchestration-config';

export interface AdhocInfo {
  type: string;
  spawnedAt: number;
  lastActivity: number;
  taskId?: string;
}

const adhocAgents = new Map<string, AdhocInfo>();

/**
 * Gets current adhoc counts by type
 */
export function getAdhocCounts(): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const [, info] of adhocAgents) {
    counts[info.type] = (counts[info.type] || 0) + 1;
  }

  return counts;
}

/**
 * Checks if can spawn adhoc of type
 */
export function canSpawnAdhoc(type: string): { canSpawn: boolean; reason?: string; typeRemaining?: number; totalRemaining?: number } {
  const limits = getLimits();
  const counts = getAdhocCounts();

  const typeCount = counts[type] || 0;
  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);

  if (typeCount >= limits.max_adhoc_per_type) {
    return { canSpawn: false, reason: 'type_limit_reached' };
  }

  if (totalCount >= limits.max_total_adhoc) {
    return { canSpawn: false, reason: 'total_limit_reached' };
  }

  return {
    canSpawn: true,
    typeRemaining: limits.max_adhoc_per_type - typeCount,
    totalRemaining: limits.max_total_adhoc - totalCount
  };
}

/**
 * Spawns an adhoc agent
 */
export function spawnAdhocAgent(type: string, options: { taskId?: string; persona?: string; skills?: string[] } = {}): { success: boolean; sessionName?: string; reason?: string } {
  const check = canSpawnAdhoc(type);

  if (!check.canSpawn) {
    return { success: false, reason: check.reason };
  }

  const sessionName = `${type}-${Date.now()}`;

  const result = spawnAgent({
    name: sessionName,
    persona: options.persona || `${type} adhoc agent`,
    skills: options.skills,
    memoryFile: `state/memory/adhoc-${type}.md`,
    isAdhoc: true
  });

  if (result.status === 'spawned' || result.status === 'already_exists') {
    adhocAgents.set(sessionName, {
      type,
      spawnedAt: Date.now(),
      lastActivity: Date.now(),
      taskId: options.taskId
    });

    return { success: true, sessionName };
  }

  return { success: false, reason: result.error };
}

/**
 * Kills an adhoc agent
 */
export function killAdhocAgent(sessionName: string): { success: boolean; reason?: string } {
  const info = adhocAgents.get(sessionName);

  if (!info) {
    return { success: false, reason: 'not_tracked' };
  }

  const result = killAgent(sessionName, true);

  if (result.status === 'spawned') { // 'spawned' means killed
    adhocAgents.delete(sessionName);
    return { success: true };
  }

  return { success: false, reason: result.error };
}

/**
 * Updates adhoc agent activity
 */
export function updateAdhocActivity(sessionName: string): void {
  const info = adhocAgents.get(sessionName);
  if (info) {
    info.lastActivity = Date.now();
  }
}

/**
 * Finds idle adhoc agents
 */
export function findIdleAdhocAgents(timeoutMs?: number): string[] {
  const limits = getLimits();
  const timeout = timeoutMs || limits.adhoc_idle_timeout_ms || 1800000;
  const now = Date.now();
  const idle: string[] = [];

  for (const [sessionName, info] of adhocAgents) {
    if (now - info.lastActivity > timeout) {
      idle.push(sessionName);
    }
  }

  return idle;
}

/**
 * Cleans up idle adhoc agents
 */
export function cleanupIdleAdhocAgents(timeoutMs?: number): { checked: number; killed: number; killedSessions: string[] } {
  const idle = findIdleAdhocAgents(timeoutMs);
  const killed: string[] = [];

  for (const sessionName of idle) {
    const result = killAdhocAgent(sessionName);
    if (result.success) {
      killed.push(sessionName);
    }
  }

  return {
    checked: adhocAgents.size,
    killed: killed.length,
    killedSessions: killed
  };
}

/**
 * Lists all adhoc agents
 */
export function listAdhocAgents(): Array<{ sessionName: string; running: boolean } & AdhocInfo> {
  const result: Array<{ sessionName: string; running: boolean } & AdhocInfo> = [];

  for (const [sessionName, info] of adhocAgents) {
    result.push({
      sessionName,
      ...info,
      running: isAgentRunning(sessionName, true)
    });
  }

  return result;
}
