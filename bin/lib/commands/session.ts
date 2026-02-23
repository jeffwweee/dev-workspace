import {
  listSessions,
  getSession,
  deleteSession,
  updateSession,
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
