import {
  listSessions,
  getSession,
  deleteSession,
  updateSession,
  updateLastActivity,
  isSessionOld,
  type SessionRegistryEntry,
  type SessionData
} from '../state/manager.js';

interface SessionDisplay {
  id: string;
  projectName: string | null;
  taskId: string | null;
  status: string;
  createdAt: string;
  lastActivity: string;
  isOld: boolean;
}

/**
 * List all sessions
 */
export async function listSessionsCmd(showAll: boolean = false): Promise<{
  success: boolean;
  sessions: SessionDisplay[];
  count: number;
}> {
  const sessions = listSessions();
  const filtered = showAll ? sessions : sessions.filter(s => s.status === 'active');

  const display: SessionDisplay[] = filtered.map(s => ({
    id: s.id,
    projectName: s.projectName,
    taskId: s.taskId,
    status: s.status,
    createdAt: s.createdAt,
    lastActivity: s.lastActivity,
    isOld: isSessionOld(s)
  }));

  return {
    success: true,
    sessions: display,
    count: display.length
  };
}

/**
 * End a session
 */
export async function endSession(
  sessionId: string | undefined,
  force: boolean = false
): Promise<{
  success: boolean;
  error?: string;
  message?: string;
  session?: SessionData;
}> {
  // If no session ID provided, try to find current session
  // For now, we'll require an explicit session ID
  if (!sessionId) {
    return {
      success: false,
      error: 'DW_SESSION_REQUIRED',
      message: 'Session ID required. Use: dw end <session_id>'
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

  // Check for active locks
  if (session.locks.length > 0 && !force) {
    return {
      success: false,
      error: 'DW_ACTIVE_LOCKS',
      message: `Session has ${session.locks.length} active lock(s). Use --force to end anyway.`,
      session
    };
  }

  // End the session
  const deleted = deleteSession(sessionId);
  if (!deleted) {
    return {
      success: false,
      error: 'DW_END_FAILED',
      message: 'Failed to end session'
    };
  }

  return {
    success: true,
    message: `Session ${sessionId} ended`,
    session
  };
}

/**
 * Update session activity (heartbeat)
 */
export async function sessionHeartbeat(
  sessionId: string | undefined
): Promise<{
  success: boolean;
  error?: string;
  message?: string;
  session?: SessionData;
}> {
  if (!sessionId) {
    // Find the most recently active session
    const sessions = listSessions().filter(s => s.status === 'active');
    if (sessions.length === 0) {
      return {
        success: false,
        error: 'DW_NO_SESSION',
        message: 'No active session found'
      };
    }
    sessions.sort((a, b) =>
      new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
    );
    sessionId = sessions[0].id;
  }

  const session = getSession(sessionId);
  if (!session) {
    return {
      success: false,
      error: 'DW_SESSION_NOT_FOUND',
      message: `Session ${sessionId} not found`
    };
  }

  updateLastActivity(sessionId);

  return {
    success: true,
    message: `Session ${sessionId} activity updated`,
    session: getSession(sessionId) || undefined
  };
}
