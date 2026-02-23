import {
  getStatePath,
  getRegistryPath,
  readJson,
  atomicWrite,
  auditLog,
  listSessions,
  getSession,
  updateSession,
  deleteSession,
  isSessionOld,
  isLockExpired,
  type Lock,
  type Project
} from '../state/manager.js';
import { listWorktrees, removeWorktree } from './worktree.js';

export interface CleanupResult {
  success: boolean;
  sessions: {
    expired: number;
    ended: string[];
  };
  locks: {
    expired: number;
  };
  worktrees: {
    orphaned: Array<{
      path: string;
      projectName: string;
      taskId: string;
    }>;
  };
  message: string;
}

/**
 * Clean up expired sessions, locks, and find orphaned worktrees
 */
export async function cleanup(options: {
  sessionTtl?: number;  // hours
  dryRun?: boolean;
}): Promise<CleanupResult> {
  const locksPath = getStatePath('locks.json');
  const projectsPath = getRegistryPath('projects.json');
  const sessionTtl = options.sessionTtl || 24;

  const sessions = listSessions();
  const locksData = readJson<{ locks: Lock[] }>(locksPath, { locks: [] });
  const projectsData = readJson<{ projects: Project[] }>(projectsPath, { projects: [] });

  const result: CleanupResult = {
    success: true,
    sessions: { expired: 0, ended: [] },
    locks: { expired: 0 },
    worktrees: { orphaned: [] },
    message: ''
  };

  // 1. Mark expired locks
  for (const lock of locksData.locks) {
    if (lock.status === 'active' && isLockExpired(lock)) {
      if (!options.dryRun) {
        lock.status = 'expired';
      }
      result.locks.expired++;
    }
  }

  if (result.locks.expired > 0 && !options.dryRun) {
    atomicWrite(locksPath, locksData);
  }

  // 2. Handle expired sessions
  for (const session of sessions) {
    if (session.status !== 'active') continue;

    if (isSessionOld(session, sessionTtl)) {
      const sessionData = getSession(session.id);

      // Release locks owned by this session
      if (sessionData && sessionData.locks.length > 0) {
        for (const lock of locksData.locks) {
          if (lock.ownerId === session.id && lock.status === 'active') {
            if (!options.dryRun) {
              lock.status = 'released';
            }
          }
        }
      }

      // End the session
      if (!options.dryRun) {
        deleteSession(session.id);
      }

      result.sessions.expired++;
      result.sessions.ended.push(session.id);
    }
  }

  if (result.sessions.expired > 0 && !options.dryRun) {
    atomicWrite(locksPath, locksData);
  }

  // 3. Find orphaned worktrees (worktrees with no active session)
  const activeSessions = sessions.filter(s => s.status === 'active');
  const activeWorktreePaths = new Set(
    activeSessions
      .filter(s => s.worktreePath)
      .map(s => s.worktreePath)
  );

  for (const project of projectsData.projects) {
    try {
      const worktrees = listWorktrees(project.path);
      for (const wt of worktrees) {
        if (!activeWorktreePaths.has(wt.path)) {
          result.worktrees.orphaned.push({
            path: wt.path,
            projectName: wt.projectName,
            taskId: wt.taskId
          });
        }
      }
    } catch {
      // Skip projects that aren't git repos
    }
  }

  // Build message
  const messages: string[] = [];
  if (result.sessions.expired > 0) {
    messages.push(`Ended ${result.sessions.expired} expired session(s)`);
  }
  if (result.locks.expired > 0) {
    messages.push(`Marked ${result.locks.expired} expired lock(s)`);
  }
  if (result.worktrees.orphaned.length > 0) {
    messages.push(`Found ${result.worktrees.orphaned.length} orphaned worktree(s)`);
  }
  if (messages.length === 0) {
    messages.push('Nothing to clean up');
  }
  if (options.dryRun) {
    messages.unshift('[DRY RUN]');
  }

  result.message = messages.join('. ');

  // Audit log
  if (!options.dryRun && (result.sessions.expired > 0 || result.locks.expired > 0)) {
    auditLog({
      timestamp: new Date().toISOString(),
      event: 'cleanup',
      sessionId: 'SYSTEM',
      data: {
        sessionsExpired: result.sessions.expired,
        locksExpired: result.locks.expired,
        orphanedWorktrees: result.worktrees.orphaned.length
      }
    });
  }

  return result;
}

/**
 * Prune orphaned worktrees
 */
export async function pruneWorktrees(options: {
  dryRun?: boolean;
}): Promise<{
  success: boolean;
  removed: Array<{ path: string; projectName: string; taskId: string }>;
  failed: Array<{ path: string; error: string }>;
  message: string;
}> {
  const projectsPath = getRegistryPath('projects.json');
  const projectsData = readJson<{ projects: Project[] }>(projectsPath, { projects: [] });
  const sessions = listSessions().filter(s => s.status === 'active');

  const activeWorktreePaths = new Set(
    sessions
      .filter(s => s.worktreePath)
      .map(s => s.worktreePath)
  );

  const removed: Array<{ path: string; projectName: string; taskId: string }> = [];
  const failed: Array<{ path: string; error: string }> = [];

  for (const project of projectsData.projects) {
    try {
      const worktrees = listWorktrees(project.path);
      for (const wt of worktrees) {
        if (!activeWorktreePaths.has(wt.path)) {
          if (options.dryRun) {
            removed.push({
              path: wt.path,
              projectName: wt.projectName,
              taskId: wt.taskId
            });
          } else {
            try {
              removeWorktree(project.path, wt.path, true);
              removed.push({
                path: wt.path,
                projectName: wt.projectName,
                taskId: wt.taskId
              });
            } catch (error) {
              failed.push({
                path: wt.path,
                error: String(error)
              });
            }
          }
        }
      }
    } catch {
      // Skip projects that aren't git repos
    }
  }

  const message = options.dryRun
    ? `[DRY RUN] Would remove ${removed.length} orphaned worktree(s)`
    : `Removed ${removed.length} orphaned worktree(s)${failed.length > 0 ? `, ${failed.length} failed` : ''}`;

  return {
    success: failed.length === 0,
    removed,
    failed,
    message
  };
}
