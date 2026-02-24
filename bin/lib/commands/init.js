import { listSessions, createSession, getSession, updateSession, isSessionOld, detectSessionContext } from '../state/manager.js';
import { ensureV2 } from '../state/migrate.js';
/**
 * Format session age for display
 */
function formatAge(lastActivity) {
    const then = new Date(lastActivity);
    const now = new Date();
    const diffMs = now.getTime() - then.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    if (diffHours < 1) {
        const diffMins = Math.floor(diffMs / (1000 * 60));
        return { text: `${diffMins}m ago`, hours: diffHours };
    }
    else if (diffHours < 24) {
        return { text: `${Math.floor(diffHours)}h ago`, hours: diffHours };
    }
    else {
        const diffDays = Math.floor(diffHours / 24);
        return { text: `${diffDays}d ago`, hours: diffHours };
    }
}
/**
 * Initialize or resume a session
 *
 * Modes:
 * - No sessions exist: create new (auto-detect tmux/tg session)
 * - Sessions exist but no selection: return picker data
 * - --new flag: create new session (auto-detect tmux/tg session)
 * - --resume <id>: resume specific session
 */
export async function init(options) {
    // Ensure we're on v2 format
    ensureV2();
    // Detect tmux/telegram session context
    const context = detectSessionContext();
    const sessions = listSessions().filter(s => s.status === 'active');
    // Mode 1: Explicit new session
    if (options.new) {
        // If in mapped tmux session, use tg session ID
        if (context.tgSessionId && context.tgConfig) {
            // Check if this tg session already exists
            const existingSession = sessions.find(s => s.tgSessionId === context.tgSessionId);
            if (existingSession) {
                // Resume it instead
                const session = getSession(existingSession.id);
                if (session) {
                    const updated = updateSession(existingSession.id, { status: 'active' });
                    return {
                        success: true,
                        action: 'resumed',
                        session: updated || undefined,
                        tgSession: {
                            id: context.tgSessionId,
                            botUsername: context.tgConfig.bot_username,
                            purpose: context.tgConfig.purpose
                        },
                        message: `Resumed session ${existingSession.id} (TG: ${context.tgSessionId})`
                    };
                }
            }
            // Create new with tg session ID
            const session = createSession(context.tgSessionId, {
                tgSessionId: context.tgSessionId,
                tmuxSession: context.tmuxSession || undefined
            });
            return {
                success: true,
                action: 'created',
                session,
                tgSession: {
                    id: context.tgSessionId,
                    botUsername: context.tgConfig.bot_username,
                    purpose: context.tgConfig.purpose
                },
                message: `Created session ${session.id} (TG: ${context.tgSessionId})`
            };
        }
        // Not in mapped tmux - create with generated ID
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
        // Get tg session info if available
        const tgSession = session.tgSessionId && context.tgConfig ? {
            id: session.tgSessionId,
            botUsername: context.tgConfig.bot_username,
            purpose: context.tgConfig.purpose
        } : undefined;
        return {
            success: true,
            action: 'resumed',
            session: updated || undefined,
            tgSession,
            message: `Resumed session ${options.resume}`
        };
    }
    // Mode 3: No sessions exist - create new (with auto-detection)
    if (sessions.length === 0) {
        // If in mapped tmux session, use tg session ID
        if (context.tgSessionId && context.tgConfig) {
            const session = createSession(context.tgSessionId, {
                tgSessionId: context.tgSessionId,
                tmuxSession: context.tmuxSession || undefined
            });
            return {
                success: true,
                action: 'created',
                session,
                tgSession: {
                    id: context.tgSessionId,
                    botUsername: context.tgConfig.bot_username,
                    purpose: context.tgConfig.purpose
                },
                message: `Created session ${session.id} (TG: ${context.tgSessionId})`
            };
        }
        // Not in mapped tmux - create with generated ID
        const session = createSession();
        return {
            success: true,
            action: 'created',
            session,
            message: 'Created new session (no existing sessions)'
        };
    }
    // Mode 4: Sessions exist - return picker data
    const pickerEntries = sessions.map(s => {
        const age = formatAge(s.lastActivity);
        return {
            id: s.id,
            projectName: s.projectName,
            taskId: s.taskId,
            tgSessionId: s.tgSessionId,
            tmuxSession: s.tmuxSession,
            status: s.status,
            lastActivity: s.lastActivity,
            isOld: isSessionOld(s),
            ageHours: age.hours
        };
    });
    // Include context info if in mapped tmux
    const tgSession = context.tgSessionId && context.tgConfig ? {
        id: context.tgSessionId,
        botUsername: context.tgConfig.bot_username,
        purpose: context.tgConfig.purpose
    } : undefined;
    return {
        success: true,
        action: 'picker',
        sessions: pickerEntries,
        tgSession,
        message: tgSession
            ? `In tmux session mapped to ${tgSession.id}. Multiple sessions exist - select one or create new.`
            : 'Multiple sessions exist - select one or create new'
    };
}
/**
 * Create a new session (wrapper for backward compatibility)
 */
export async function newSession() {
    return init({ new: true });
}
/**
 * Resume a session by ID
 */
export async function resumeSession(sessionId) {
    return init({ resume: sessionId });
}
//# sourceMappingURL=init.js.map