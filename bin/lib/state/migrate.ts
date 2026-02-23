import fs from 'fs';
import {
  getStatePath,
  getSessionFilePath,
  atomicWrite,
  readJson,
  auditLog,
  generateId,
  type Session,
  type SessionData,
  type SessionRegistryEntry,
  type SessionsRegistry
} from '../state/manager.js';

const MIGRATION_FLAG = getStatePath('.migrated-v2');

/**
 * Check if migration has already been done
 */
export function isMigrated(): boolean {
  return fs.existsSync(MIGRATION_FLAG);
}

/**
 * Mark migration as complete
 */
function markMigrated(): void {
  fs.writeFileSync(MIGRATION_FLAG, new Date().toISOString(), 'utf8');
}

/**
 * Migrate from v1 (single session in active.json) to v2 (sessions registry)
 *
 * This creates:
 * - state/sessions.json (registry)
 * - state/sessions/SESS-XXX.json (per-session data)
 */
export function migrateToV2(): { success: boolean; message: string; sessionIds?: string[] } {
  // Already migrated
  if (isMigrated()) {
    return { success: true, message: 'Already migrated to v2' };
  }

  const activePath = getStatePath('active.json');
  const sessionsDir = getStatePath('sessions');

  // Ensure sessions directory exists
  if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true });
  }

  // Read old session data
  const oldSession = readJson<Session>(activePath, {
    sessionId: null,
    activeProject: null,
    startTime: null,
    status: 'inactive'
  });

  const now = new Date().toISOString();
  const migratedSessionIds: string[] = [];

  // If there was an active session, migrate it
  if (oldSession.sessionId && oldSession.status === 'active') {
    const sessionId = oldSession.sessionId;

    // Create per-session file
    const sessionData: SessionData = {
      id: sessionId,
      project: null, // Will be set when user picks project
      currentTask: null,
      worktree: null,
      locks: [],
      prUrl: null,
      status: 'active',
      createdAt: oldSession.startTime || now,
      lastActivity: now
    };

    atomicWrite(getSessionFilePath(sessionId), sessionData);
    migratedSessionIds.push(sessionId);

    // Create registry entry
    const entry: SessionRegistryEntry = {
      id: sessionId,
      projectId: oldSession.activeProject,
      projectName: null,
      taskId: null,
      worktreePath: null,
      status: 'active',
      createdAt: oldSession.startTime || now,
      lastActivity: now
    };

    // Create registry
    const registry: SessionsRegistry = {
      sessions: [entry],
      version: '2.0'
    };

    atomicWrite(getStatePath('sessions.json'), registry);

    // Backup old active.json
    const backupPath = getStatePath('active.json.v1-backup');
    fs.copyFileSync(activePath, backupPath);

    // Audit log
    auditLog({
      timestamp: now,
      event: 'migration_v1_to_v2',
      sessionId,
      data: {
        action: 'migrate',
        originalSessionId: oldSession.sessionId,
        originalStartTime: oldSession.startTime
      }
    });
  } else {
    // No active session, just create empty registry
    const registry: SessionsRegistry = {
      sessions: [],
      version: '2.0'
    };
    atomicWrite(getStatePath('sessions.json'), registry);
  }

  // Mark as migrated
  markMigrated();

  return {
    success: true,
    message: migratedSessionIds.length > 0
      ? `Migrated ${migratedSessionIds.length} session(s) to v2 format`
      : 'Created empty v2 registry (no active sessions to migrate)',
    sessionIds: migratedSessionIds
  };
}

/**
 * Auto-migrate if needed (call this at startup)
 */
export function ensureV2(): void {
  if (!isMigrated()) {
    const result = migrateToV2();
    console.log(`[dw] Migration: ${result.message}`);
  }
}
