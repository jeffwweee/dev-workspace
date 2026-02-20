import { getStatePath, getRegistryPath, readJson } from '../state/manager.js';
export async function status() {
    const activePath = getStatePath('active.json');
    const locksPath = getStatePath('locks.json');
    const projectsPath = getRegistryPath('projects.json');
    const session = readJson(activePath, {
        sessionId: null,
        activeProject: null,
        startTime: null,
        status: 'inactive'
    });
    const locksData = readJson(locksPath, { locks: [] });
    const projectsData = readJson(projectsPath, { projects: [] });
    // Filter active locks
    const activeLocks = locksData.locks.filter(l => l.status === 'active');
    const myLocks = session.sessionId
        ? activeLocks.filter(l => l.ownerId === session.sessionId)
        : [];
    // Find active project details
    const activeProject = session.activeProject
        ? projectsData.projects.find(p => p.id === session.activeProject || p.name === session.activeProject)
        : null;
    return {
        session: {
            id: session.sessionId,
            status: session.status,
            startTime: session.startTime,
            activeProject: activeProject
                ? {
                    id: activeProject.id,
                    name: activeProject.name,
                    path: activeProject.path
                }
                : null
        },
        locks: {
            total: activeLocks.length,
            owned: myLocks.length,
            items: myLocks.map(l => ({
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