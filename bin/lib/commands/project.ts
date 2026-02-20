import { getRegistryPath, getStatePath, generateId, atomicWrite, readJson, auditLog, type Project } from '../state/manager.js';

export async function addProject(name: string, options: { path?: string; remote?: string }): Promise<Record<string, unknown>> {
  if (!options.path) {
    return {
      success: false,
      error: 'DW_MISSING_PATH',
      message: '--path is required'
    };
  }

  const projectsPath = getRegistryPath('projects.json');
  const data = readJson<{ projects: Project[] }>(projectsPath, { projects: [] });

  // Check for duplicate name
  if (data.projects.some(p => p.name === name)) {
    return {
      success: false,
      error: 'DW_DUPLICATE_PROJECT',
      message: `Project '${name}' already exists`
    };
  }

  const newProject: Project = {
    id: generateId('proj'),
    name,
    path: options.path,
    remote: options.remote,
    addedAt: new Date().toISOString()
  };

  data.projects.push(newProject);
  (data as { lastUpdated?: string }).lastUpdated = new Date().toISOString();
  atomicWrite(projectsPath, data);

  auditLog({
    timestamp: new Date().toISOString(),
    event: 'project_added',
    sessionId: 'system',
    data: { projectId: newProject.id, name, path: options.path }
  });

  return {
    success: true,
    project: {
      id: newProject.id,
      name: newProject.name,
      path: newProject.path
    },
    message: `Project '${name}' added successfully`
  };
}

export async function listProjects(): Promise<Record<string, unknown>> {
  const projectsPath = getRegistryPath('projects.json');
  const data = readJson<{ projects: Project[] }>(projectsPath, { projects: [] });

  return {
    success: true,
    count: data.projects.length,
    projects: data.projects.map(p => ({
      id: p.id,
      name: p.name,
      path: p.path,
      remote: p.remote || null,
      addedAt: p.addedAt,
      lastAccessed: p.lastAccessed || null
    }))
  };
}
