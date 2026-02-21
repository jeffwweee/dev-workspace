import { getStatePath, getRegistryPath, readJson, atomicWrite, auditLog } from '../state/manager.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, '../../..');

interface Project {
    id: string;
    name: string;
    path: string;
    remote?: string;
    lastAccessed?: string;
}

interface Session {
    sessionId: string | null;
    activeProject: string | null;
    startTime: string | null;
    status: string;
}

interface ProjectsData {
    projects: Project[];
}

interface WorkResult {
    success: boolean;
    error?: string;
    message?: string;
    project?: {
        id: string;
        name: string;
        path: string;
    };
    hasContext?: boolean;
    hasSkills?: boolean;
    skillCount?: number;
    workspaceRoot?: string;
    shellCommand?: string;
}

interface DoneResult {
    success: boolean;
    error?: string;
    message?: string;
    releasedProject?: string | null;
    workspaceRoot?: string;
    shellCommand?: string;
}

export async function work(projectId: string): Promise<WorkResult> {
    const activePath = getStatePath('active.json');
    const projectsPath = getRegistryPath('projects.json');

    const session = readJson(activePath, {
        sessionId: null,
        activeProject: null,
        startTime: null,
        status: 'inactive'
    }) as Session;

    if (!session.sessionId || session.status !== 'active') {
        return {
            success: false,
            error: 'DW_NO_SESSION',
            message: 'No active session. Run "dw init" first.'
        };
    }

    const projectsData = readJson(projectsPath, { projects: [] }) as ProjectsData;
    const project = projectsData.projects.find((p) => p.id === projectId || p.name === projectId);

    if (!project) {
        return {
            success: false,
            error: 'DW_NO_PROJECT',
            message: `Project '${projectId}' not found`
        };
    }

    if (!fs.existsSync(project.path)) {
        return {
            success: false,
            error: 'DW_INVALID_PATH',
            message: `Project path does not exist: ${project.path}`
        };
    }

    // Update active project
    const newSession = {
        ...session,
        activeProject: project.id
    };
    atomicWrite(activePath, newSession);

    // Update last accessed
    project.lastAccessed = new Date().toISOString();
    atomicWrite(projectsPath, projectsData);

    auditLog({
        timestamp: new Date().toISOString(),
        event: 'project_work_start',
        sessionId: session.sessionId,
        data: { projectId: project.id, projectName: project.name }
    });

    // Resolve absolute path
    const absolutePath = path.resolve(WORKSPACE_ROOT, project.path);

    // Load project context
    const contextPath = path.join(absolutePath, '.claude', 'PROJECT_CONTEXT.md');
    const hasContext = fs.existsSync(contextPath);

    // Check for skills
    const skillsPath = path.join(absolutePath, '.claude', 'skills');
    const hasSkills = fs.existsSync(skillsPath);
    let skillCount = 0;
    if (hasSkills) {
        try {
            skillCount = fs.readdirSync(skillsPath).filter(f => {
                const skillDir = path.join(skillsPath, f);
                return fs.statSync(skillDir).isDirectory() &&
                       fs.existsSync(path.join(skillDir, 'SKILL.md'));
            }).length;
        } catch { /* ignore */ }
    }

    return {
        success: true,
        project: {
            id: project.id,
            name: project.name,
            path: absolutePath
        },
        hasContext,
        hasSkills,
        skillCount,
        workspaceRoot: WORKSPACE_ROOT,
        shellCommand: `cd "${absolutePath}"`,
        message: `Starting work on '${project.name}'`
    };
}

export async function done(): Promise<DoneResult> {
    const activePath = getStatePath('active.json');
    const session = readJson(activePath, {
        sessionId: null,
        activeProject: null,
        startTime: null,
        status: 'inactive'
    }) as Session;

    if (!session.sessionId || session.status !== 'active') {
        return {
            success: false,
            error: 'DW_NO_SESSION',
            message: 'No active session.'
        };
    }

    auditLog({
        timestamp: new Date().toISOString(),
        event: 'project_work_done',
        sessionId: session.sessionId,
        data: { projectId: session.activeProject }
    });

    // Clear active project but keep session
    const newSession = {
        ...session,
        activeProject: null
    };
    atomicWrite(activePath, newSession);

    return {
        success: true,
        releasedProject: session.activeProject,
        workspaceRoot: WORKSPACE_ROOT,
        shellCommand: `cd "${WORKSPACE_ROOT}"`,
        message: 'Returned to dev-workspace root'
    };
}
