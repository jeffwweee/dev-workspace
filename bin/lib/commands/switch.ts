import { getStatePath, getRegistryPath, atomicWrite, readJson, auditLog, type Session, type Project } from '../state/manager.js';
import fs from 'fs';
import path from 'path';

export async function switchProject(projectId: string): Promise<Record<string, unknown>> {
  const activePath = getStatePath('active.json');
  const projectsPath = getRegistryPath('projects.json');

  const session = readJson<Session>(activePath, {
    sessionId: null,
    activeProject: null,
    startTime: null,
    status: 'inactive'
  });

  if (!session.sessionId || session.status !== 'active') {
    return {
      success: false,
      error: 'DW_NO_SESSION',
      message: 'No active session. Run "dw init" first.'
    };
  }

  const projectsData = readJson<{ projects: Project[] }>(projectsPath, { projects: [] });

  // Find project by ID or name
  const project = projectsData.projects.find(
    p => p.id === projectId || p.name === projectId
  );

  if (!project) {
    return {
      success: false,
      error: 'DW_NO_PROJECT',
      message: `Project '${projectId}' not found`
    };
  }

  // Verify project path exists
  if (!fs.existsSync(project.path)) {
    return {
      success: false,
      error: 'DW_INVALID_PATH',
      message: `Project path does not exist: ${project.path}`
    };
  }

  // Update active project
  const newSession: Session = {
    ...session,
    activeProject: project.id
  };

  atomicWrite(activePath, newSession);

  // Update last accessed in registry
  project.lastAccessed = new Date().toISOString();
  atomicWrite(projectsPath, projectsData);

  auditLog({
    timestamp: new Date().toISOString(),
    event: 'project_switch',
    sessionId: session.sessionId,
    data: { projectId: project.id, projectName: project.name }
  });

  // Load project context if exists
  const contextPath = path.join(project.path, '.claude', 'PROJECT_CONTEXT.md');
  let projectContext: string | null = null;

  if (fs.existsSync(contextPath)) {
    projectContext = fs.readFileSync(contextPath, 'utf8');
  }

  // Load progress if exists
  const progressPath = path.join(project.path, 'progress.md');
  let progress: string | null = null;

  if (fs.existsSync(progressPath)) {
    progress = fs.readFileSync(progressPath, 'utf8');
  }

  return {
    success: true,
    project: {
      id: project.id,
      name: project.name,
      path: project.path,
      remote: project.remote || null
    },
    context: projectContext ? 'Loaded from PROJECT_CONTEXT.md' : 'No project context found',
    hasProgress: !!progress,
    message: `Switched to project '${project.name}'`
  };
}
