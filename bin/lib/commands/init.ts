import {
  listSessions,
  createSession,
  getSession,
  updateSession,
  isSessionOld,
  type SessionRegistryEntry,
  type SessionData
} from '../state/manager.js';
import { ensureV2 } from '../state/migrate.js';

export interface InitResult {
  success: boolean;
  action: 'created' | 'resumed' | 'picker';
  session?: SessionData;
  sessions?: SessionPickerEntry[];
  error?: string;
  message?: string;
}

export interface SessionPickerEntry {
  id: string;
  projectName: string | null;
  taskId: string | null;
  status: string;
  lastActivity: string;
  isOld: boolean;
  ageHours: number;
}

/**
 * Format session age for display
 */
function formatAge(lastActivity: string): { text: string; hours: number } {
  const then = new Date(lastActivity);
  const now = new Date();
  const diffMs = now.getTime() - then.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 1) {
    const diffMins = Math.floor(diffMs / (1000 * 60));
    return { text: `${diffMins}m ago`, hours: diffHours };
  } else if (diffHours < 24) {
    return { text: `${Math.floor(diffHours)}h ago`, hours: diffHours };
  } else {
    const diffDays = Math.floor(diffHours / 24);
    return { text: `${diffDays}d ago`, hours: diffHours };
  }
}

/**
 * Initialize or resume a session
 *
 * Modes:
 * - No sessions exist: create new
 * - Sessions exist but no selection: return picker data
 * - --new flag: create new session
 * - --resume <id>: resume specific session
 */
export async function init(options: {
  new?: boolean;
  resume?: string;
}): Promise<InitResult> {
  // Ensure we're on v2 format
  ensureV2();

  const sessions = listSessions().filter(s => s.status === 'active');

  // Mode 1: Explicit new session
  if (options.new) {
    const session = createSession();
    return {
      success: true,
      action: 'created',
      session,
      message: `Created new session ${session.id}`
    };
  }

  // Mode 2: Explicit resume
  if (options.resume) {
    const session = getSession(options.resume);
    if (!session) {
      return {
        success: false,
        action: 'resumed',
        error: 'DW_SESSION_NOT_FOUND',
        message: `Session ${options.resume} not found`
      };
    }

    // Update activity
    const updated = updateSession(options.resume, { status: 'active' });

    return {
      success: true,
      action: 'resumed',
      session: updated || undefined,
      message: `Resumed session ${options.resume}`
    };
  }

  // Mode 3: No sessions exist - create new
  if (sessions.length === 0) {
    const session = createSession();
    return {
      success: true,
      action: 'created',
      session,
      message: 'Created new session (no existing sessions)'
    };
  }

  // Mode 4: Sessions exist - return picker data
  const pickerEntries: SessionPickerEntry[] = sessions.map(s => {
    const age = formatAge(s.lastActivity);
    return {
      id: s.id,
      projectName: s.projectName,
      taskId: s.taskId,
      status: s.status,
      lastActivity: s.lastActivity,
      isOld: isSessionOld(s),
      ageHours: age.hours
    };
  });

  return {
    success: true,
    action: 'picker',
    sessions: pickerEntries,
    message: 'Multiple sessions exist - select one or create new'
  };
}

/**
 * Create a new session (wrapper for backward compatibility)
 */
export async function newSession(): Promise<InitResult> {
  return init({ new: true });
}

/**
 * Resume a session by ID
 */
export async function resumeSession(sessionId: string): Promise<InitResult> {
  return init({ resume: sessionId });
}
