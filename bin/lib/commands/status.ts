import { getStatePath, getRegistryPath, readJson, type Session, type Lock, type Project } from '../state/manager.js';

export async function status(): Promise<Record<string, unknown>> {
  const activePath = getStatePath('active.json');
  const locksPath = getStatePath('locks.json');
  const projectsPath = getRegistryPath('projects.json');

  const session = readJson<Session>(activePath, {
    sessionId: null,
    activeProject: null,
    startTime: null,
    status: 'inactive'
  });

  const locksData = readJson<{ locks: Lock[] }>(locksPath, { locks: [] });
  const projectsData = readJson<{ projects: Project[] }>(projectsPath, { projects: [] });

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
