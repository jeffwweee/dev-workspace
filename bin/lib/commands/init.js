import { getStatePath, generateId, atomicWrite, readJson, auditLog } from '../state/manager.js';
export async function init() {
    const activePath = getStatePath('active.json');
    // Check if session already exists
    const current = readJson(activePath, {
        sessionId: null,
        activeProject: null,
        startTime: null,
        status: 'inactive'
    });
    if (current.sessionId && current.status === 'active') {
        return JSON.stringify({
            success: false,
            error: 'DW_SESSION_EXISTS',
            message: 'Session already active',
            sessionId: current.sessionId
        }, null, 2);
    }
    // Create new session
    const sessionId = generateId('sess');
    const newSession = {
        sessionId,
        activeProject: null,
        startTime: new Date().toISOString(),
        status: 'active'
    };
    atomicWrite(activePath, newSession);
    // Log to audit
    auditLog({
        timestamp: new Date().toISOString(),
        event: 'session_init',
        sessionId,
        data: { action: 'init' }
    });
    return JSON.stringify({
        success: true,
        sessionId,
        startTime: newSession.startTime,
        message: 'Session initialized successfully'
    }, null, 2);
}
//# sourceMappingURL=init.js.map