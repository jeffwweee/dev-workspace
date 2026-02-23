import {
  getStatePath,
  getRegistryPath,
  generateId,
  atomicWrite,
  readJson,
  auditLog,
  isLockExpired,
  extendLockTTL,
  getSession,
  updateSession,
  getActiveSessions,
  type Lock,
  type SessionData,
  type Project
} from '../state/manager.js';
import { createWorktree, type WorktreeInfo } from './worktree.js';

/**
 * Get current session ID from active sessions
 * For now, returns the most recently active session
 */
function getCurrentSessionId(): string | null {
  const sessions = getActiveSessions();
  if (sessions.length === 0) return null;

  // Sort by lastActivity descending and return the most recent
  sessions.sort((a, b) =>
    new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
  );

  return sessions[0].id;
}

export interface ClaimResult {
  success: boolean;
  error?: string;
  message?: string;
  lock?: {
    lockId: string;
    projectId?: string;
    taskId?: string;
    expiresAt: string;
  };
  worktree?: WorktreeInfo;
  conflictingLock?: {
    lockId: string;
    ownerId: string;
    expiresAt: string;
  };
}

export async function claim(options: {
  project?: string;
  task?: string;
  owner?: string;
  ttl?: string;
  session?: string;
  noWorktree?: boolean;
}): Promise<ClaimResult> {
  const locksPath = getStatePath('locks.json');
  const projectsPath = getRegistryPath('projects.json');

  // Get session
  const sessionId = options.session || getCurrentSessionId();
  if (!sessionId) {
    return {
      success: false,
      error: 'DW_NO_SESSION',
      message: 'No active session. Run "dw init" first.'
    };
  }

  const session = getSession(sessionId);
  if (!session) {
    return {
      success: false,
      error: 'DW_SESSION_NOT_FOUND',
      message: `Session ${sessionId} not found`
    };
  }

  const ownerId = options.owner || sessionId;
  const ttl = parseInt(options.ttl || '120', 10);

  const locksData = readJson<{ locks: Lock[] }>(locksPath, { locks: [] });
  const projectsData = readJson<{ projects: Project[] }>(projectsPath, { projects: [] });

  // Determine project
  let projectId = options.project;
  let project: Project | undefined;

  if (!projectId && session.project) {
    projectId = session.project.id;
  }

  if (projectId) {
    project = projectsData.projects.find(
      p => p.id === projectId || p.name === projectId
    );
  }

  // Check for conflicting active locks
  const conflictingLock = locksData.locks.find(l => {
    if (l.status !== 'active') return false;
    if (isLockExpired(l)) return false;

    if (options.project && l.projectId === options.project) return true;
    if (options.task && l.taskId === options.task) return true;

    return false;
  });

  if (conflictingLock) {
    return {
      success: false,
      error: 'DW_LOCKED',
      message: 'Resource already locked',
      conflictingLock: {
        lockId: conflictingLock.lockId,
        ownerId: conflictingLock.ownerId,
        expiresAt: conflictingLock.expiresAt
      }
    };
  }

  // Create worktree if claiming a task and project is known
  let worktree: WorktreeInfo | undefined;
  if (options.task && project && !options.noWorktree) {
    try {
      worktree = createWorktree(project.path, project.name, options.task);
    } catch (error) {
      return {
        success: false,
        error: 'DW_WORKTREE_FAILED',
        message: `Failed to create worktree: ${error}`
      };
    }
  }

  // Create new lock
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + ttl);

  const newLock: Lock = {
    lockId: generateId('lock'),
    projectId: project?.id || options.project,
    taskId: options.task,
    ownerId,
    acquiredAt: new Date().toISOString(),
    expiresAt: expiresAt.toISOString(),
    status: 'active'
  };

  locksData.locks.push(newLock);
  atomicWrite(locksPath, locksData);

  // Update session with lock and worktree info
  const sessionUpdates: Partial<SessionData> = {
    currentTask: options.task || session.currentTask,
    locks: [...session.locks, newLock.lockId]
  };

  if (project && !session.project) {
    sessionUpdates.project = {
      id: project.id,
      name: project.name,
      path: project.path
    };
  }

  if (worktree) {
    sessionUpdates.worktree = {
      path: worktree.path,
      branch: worktree.branch,
      createdAt: new Date().toISOString()
    };
  }

  updateSession(sessionId, sessionUpdates);

  auditLog({
    timestamp: new Date().toISOString(),
    event: 'lock_claimed',
    sessionId,
    data: {
      lockId: newLock.lockId,
      projectId: newLock.projectId,
      taskId: options.task,
      ttl,
      worktreePath: worktree?.path
    }
  });

  const messageParts = ['Lock acquired successfully'];
  if (worktree) {
    messageParts.push(`Working in ${worktree.path}`);
  }

  return {
    success: true,
    lock: {
      lockId: newLock.lockId,
      projectId: newLock.projectId,
      taskId: newLock.taskId,
      expiresAt: newLock.expiresAt
    },
    worktree,
    message: messageParts.join('. ')
  };
}

export async function release(options: {
  lock?: string;
  all?: boolean;
  owner?: string;
  session?: string;
}): Promise<Record<string, unknown>> {
  const locksPath = getStatePath('locks.json');

  const sessionId = options.session || getCurrentSessionId();
  if (!sessionId) {
    return {
      success: false,
      error: 'DW_NO_SESSION',
      message: 'No active session. Run "dw init" first.'
    };
  }

  const session = getSession(sessionId);
  const ownerId = options.owner || sessionId;
  const locksData = readJson<{ locks: Lock[] }>(locksPath, { locks: [] });

  let releasedCount = 0;
  const releasedLockIds: string[] = [];

  if (options.all) {
    // Release all locks owned by current session
    for (const lock of locksData.locks) {
      if (lock.ownerId === ownerId && lock.status === 'active') {
        lock.status = 'released';
        releasedLockIds.push(lock.lockId);
        releasedCount++;
      }
    }
  } else if (options.lock) {
    // Release specific lock
    const lock = locksData.locks.find(l => l.lockId === options.lock);

    if (!lock) {
      return {
        success: false,
        error: 'DW_LOCK_NOT_FOUND',
        message: `Lock '${options.lock}' not found`
      };
    }

    if (lock.ownerId !== ownerId) {
      return {
        success: false,
        error: 'DW_NOT_OWNER',
        message: 'You do not own this lock'
      };
    }

    lock.status = 'released';
    releasedLockIds.push(lock.lockId);
    releasedCount = 1;
  } else {
    return {
      success: false,
      error: 'DW_MISSING_ARGS',
      message: 'Specify --lock <id> or --all'
    };
  }

  if (releasedCount > 0) {
    atomicWrite(locksPath, locksData);

    // Update session to remove released locks
    if (session) {
      const updatedLocks = session.locks.filter(l => !releasedLockIds.includes(l));
      updateSession(sessionId, { locks: updatedLocks });
    }

    auditLog({
      timestamp: new Date().toISOString(),
      event: 'lock_released',
      sessionId,
      data: {
        count: releasedCount,
        lockId: options.lock || null
      }
    });
  }

  return {
    success: true,
    released: releasedCount,
    message: `Released ${releasedCount} lock(s)`
  };
}

export async function heartbeat(options: {
  owner?: string;
  lock?: string;
  session?: string;
}): Promise<Record<string, unknown>> {
  const locksPath = getStatePath('locks.json');

  const sessionId = options.session || getCurrentSessionId();
  if (!sessionId) {
    return {
      success: false,
      error: 'DW_NO_SESSION',
      message: 'No active session. Run "dw init" first.'
    };
  }

  // Update session activity
  const session = getSession(sessionId);
  if (session) {
    updateSession(sessionId, {}); // This updates lastActivity
  }

  const ownerId = options.owner || sessionId;
  const locksData = readJson<{ locks: Lock[] }>(locksPath, { locks: [] });

  let refreshedCount = 0;

  for (const lock of locksData.locks) {
    if (lock.status !== 'active') continue;
    if (lock.ownerId !== ownerId) continue;
    if (options.lock && lock.lockId !== options.lock) continue;
    if (isLockExpired(lock)) continue;

    const extended = extendLockTTL(lock);
    lock.expiresAt = extended.expiresAt;
    refreshedCount++;
  }

  if (refreshedCount > 0) {
    atomicWrite(locksPath, locksData);

    auditLog({
      timestamp: new Date().toISOString(),
      event: 'lock_heartbeat',
      sessionId,
      data: {
        count: refreshedCount,
        lockId: options.lock || null
      }
    });
  }

  return {
    success: true,
    refreshed: refreshedCount,
    sessionActivityUpdated: !!session,
    message: `Refreshed ${refreshedCount} lock(s)${session ? ', session activity updated' : ''}`
  };
}

export async function cleanupLocks(options: {
  force?: boolean;
}): Promise<Record<string, unknown>> {
  const locksPath = getStatePath('locks.json');
  const locksData = readJson<{ locks: Lock[] }>(locksPath, { locks: [] });

  const now = new Date();
  let expiredCount = 0;
  let forcedCount = 0;

  for (const lock of locksData.locks) {
    if (lock.status !== 'active') continue;

    // Mark expired locks
    if (isLockExpired(lock)) {
      lock.status = 'expired';
      expiredCount++;
      continue;
    }

    // Force cleanup: locks older than 24 hours
    if (options.force) {
      const acquiredAt = new Date(lock.acquiredAt);
      const hoursSinceAcquired = (now.getTime() - acquiredAt.getTime()) / (1000 * 60 * 60);

      if (hoursSinceAcquired > 24) {
        lock.status = 'expired';
        forcedCount++;
      }
    }
  }

  atomicWrite(locksPath, locksData);

  return {
    success: true,
    expired: expiredCount,
    forced: forcedCount,
    total: expiredCount + forcedCount,
    message: `Marked ${expiredCount + forcedCount} lock(s) as expired`
  };
}
