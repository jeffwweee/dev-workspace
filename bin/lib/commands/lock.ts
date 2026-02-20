import { getStatePath, generateId, atomicWrite, readJson, auditLog, isLockExpired, extendLockTTL, type Lock, type Session } from '../state/manager.js';

async function getCurrentSession(): Promise<string | null> {
  const activePath = getStatePath('active.json');
  const session = await readJson<Session>(activePath, {
    sessionId: null,
    activeProject: null,
    startTime: null,
    status: 'inactive'
  });
  return session.sessionId;
}

export async function claim(options: {
  project?: string;
  task?: string;
  owner?: string;
  ttl?: string;
}): Promise<Record<string, unknown>> {
  const locksPath = getStatePath('locks.json');
  const activePath = getStatePath('active.json');

  const sessionId = await getCurrentSession();
  if (!sessionId) {
    return {
      success: false,
      error: 'DW_NO_SESSION',
      message: 'No active session. Run "dw init" first.'
    };
  }

  const ownerId = options.owner || sessionId;
  const ttl = parseInt(options.ttl || '120', 10);

  const locksData = readJson<{ locks: Lock[] }>(locksPath, { locks: [] });

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

  // Create new lock
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + ttl);

  const newLock: Lock = {
    lockId: generateId('lock'),
    projectId: options.project,
    taskId: options.task,
    ownerId,
    acquiredAt: new Date().toISOString(),
    expiresAt: expiresAt.toISOString(),
    status: 'active'
  };

  locksData.locks.push(newLock);
  atomicWrite(locksPath, locksData);

  auditLog({
    timestamp: new Date().toISOString(),
    event: 'lock_claimed',
    sessionId,
    data: {
      lockId: newLock.lockId,
      projectId: options.project,
      taskId: options.task,
      ttl
    }
  });

  return {
    success: true,
    lock: {
      lockId: newLock.lockId,
      projectId: newLock.projectId,
      taskId: newLock.taskId,
      expiresAt: newLock.expiresAt
    },
    message: 'Lock acquired successfully'
  };
}

export async function release(options: {
  lock?: string;
  all?: boolean;
  owner?: string;
}): Promise<Record<string, unknown>> {
  const locksPath = getStatePath('locks.json');

  const sessionId = await getCurrentSession();
  if (!sessionId) {
    return {
      success: false,
      error: 'DW_NO_SESSION',
      message: 'No active session. Run "dw init" first.'
    };
  }

  const ownerId = options.owner || sessionId;
  const locksData = readJson<{ locks: Lock[] }>(locksPath, { locks: [] });

  let releasedCount = 0;

  if (options.all) {
    // Release all locks owned by current session
    for (const lock of locksData.locks) {
      if (lock.ownerId === ownerId && lock.status === 'active') {
        lock.status = 'released';
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
}): Promise<Record<string, unknown>> {
  const locksPath = getStatePath('locks.json');

  const sessionId = await getCurrentSession();
  if (!sessionId) {
    return {
      success: false,
      error: 'DW_NO_SESSION',
      message: 'No active session. Run "dw init" first.'
    };
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
    message: `Refreshed ${refreshedCount} lock(s)`
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
