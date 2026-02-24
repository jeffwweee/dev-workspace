import { getStatePath, getRegistryPath, readJson, getActiveSessions, getSession } from '../state/manager.js';
export async function status() {
    const locksPath = getStatePath('locks.json');
    const projectsPath = getRegistryPath('projects.json');
    // Get all active sessions
    const activeSessions = getActiveSessions();
    // Get the most recently active session as "current"
    const currentSessionEntry = activeSessions.length > 0
        ? activeSessions.sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime())[0]
        : null;
    const currentSession = currentSessionEntry ? getSession(currentSessionEntry.id) : null;
    const locksData = readJson(locksPath, { locks: [] });
    const projectsData = readJson(projectsPath, { projects: [] });
    // Filter active locks
    const activeLocks = locksData.locks.filter(l => l.status === 'active');
    // Get locks for current session
    const currentSessionLocks = currentSession
        ? activeLocks.filter(l => l.ownerId === currentSession.id)
        : [];
    // Build session summaries
    const sessionSummaries = activeSessions.map(s => {
        const sessionData = getSession(s.id);
        return {
            id: s.id,
            projectName: s.projectName,
            taskId: s.taskId,
            worktreePath: s.worktreePath,
            status: s.status,
            lastActivity: s.lastActivity,
            lockCount: sessionData?.locks.length || 0,
            isCurrent: s.id === currentSessionEntry?.id
        };
    });
    return {
        currentSession: currentSession
            ? {
                id: currentSession.id,
                status: currentSession.status,
                project: currentSession.project,
                currentTask: currentSession.currentTask,
                worktree: currentSession.worktree,
                locks: currentSession.locks,
                prUrl: currentSession.prUrl,
                createdAt: currentSession.createdAt,
                lastActivity: currentSession.lastActivity
            }
            : null,
        allSessions: sessionSummaries,
        locks: {
            total: activeLocks.length,
            ownedByCurrent: currentSessionLocks.length,
            items: currentSessionLocks.map(l => ({
                lockId: l.lockId,
                projectId: l.projectId,
                taskId: l.taskId,
                expiresAt: l.expiresAt
            }))
        },
        projects: {
            total: projectsData.projects.length,
            items: projectsData.projects.map(p => ({
                id: p.id,
                name: p.name,
                path: p.path
            }))
        }
    };
}
//# sourceMappingURL=status.js.map