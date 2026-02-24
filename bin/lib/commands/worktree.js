import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { getWorktreePath, getRegistryPath, readJson } from '../state/manager.js';
/**
 * Check if we're in a git repository
 */
function isGitRepo(projectPath) {
    try {
        execSync('git rev-parse --git-dir', { cwd: projectPath, stdio: 'pipe' });
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Get current branch name
 */
function getCurrentBranch(projectPath) {
    try {
        return execSync('git rev-parse --abbrev-ref HEAD', {
            cwd: projectPath,
            encoding: 'utf-8'
        }).trim();
    }
    catch {
        return 'main';
    }
}
/**
 * Check if branch exists
 */
function branchExists(projectPath, branchName) {
    try {
        execSync(`git rev-parse --verify ${branchName}`, {
            cwd: projectPath,
            stdio: 'pipe'
        });
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Create a worktree for a task
 */
export function createWorktree(projectPath, projectName, taskId, branchName) {
    // Validate project is a git repo
    if (!isGitRepo(projectPath)) {
        throw new Error(`Not a git repository: ${projectPath}`);
    }
    const worktreePath = getWorktreePath(projectName, taskId);
    const branch = branchName || `feature/${taskId}`;
    // Ensure worktrees base directory exists
    const baseDir = path.dirname(worktreePath);
    if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir, { recursive: true });
    }
    // Check if worktree already exists
    if (fs.existsSync(worktreePath)) {
        return {
            path: worktreePath,
            branch,
            taskId,
            projectName,
            exists: true
        };
    }
    // Create the worktree
    // If branch exists, use it; otherwise create new branch
    const branchOption = branchExists(projectPath, branch)
        ? branch
        : `-b ${branch}`;
    try {
        execSync(`git worktree add "${worktreePath}" ${branchOption}`, {
            cwd: projectPath,
            encoding: 'utf-8'
        });
    }
    catch (error) {
        throw new Error(`Failed to create worktree: ${error}`);
    }
    return {
        path: worktreePath,
        branch,
        taskId,
        projectName,
        exists: true
    };
}
/**
 * Remove a worktree
 */
export function removeWorktree(projectPath, worktreePath, force = false) {
    if (!fs.existsSync(worktreePath)) {
        return {
            success: true,
            message: 'Worktree does not exist'
        };
    }
    const forceFlag = force ? '--force' : '';
    try {
        execSync(`git worktree remove "${worktreePath}" ${forceFlag}`.trim(), {
            cwd: projectPath,
            encoding: 'utf-8'
        });
        return {
            success: true,
            message: `Worktree removed: ${worktreePath}`
        };
    }
    catch (error) {
        // If normal remove fails, try force
        if (!force) {
            return removeWorktree(projectPath, worktreePath, true);
        }
        throw new Error(`Failed to remove worktree: ${error}`);
    }
}
/**
 * List all worktrees for a project
 */
export function listWorktrees(projectPath) {
    if (!isGitRepo(projectPath)) {
        return [];
    }
    try {
        const output = execSync('git worktree list --porcelain', {
            cwd: projectPath,
            encoding: 'utf-8'
        });
        const worktrees = [];
        const lines = output.split('\n');
        let currentPath = '';
        let currentBranch = '';
        for (const line of lines) {
            if (line.startsWith('worktree ')) {
                currentPath = line.substring('worktree '.length);
            }
            else if (line.startsWith('branch ')) {
                currentBranch = line.substring('branch '.length);
            }
            else if (line === '' && currentPath) {
                // Extract task ID from path if it matches our pattern
                const pathParts = currentPath.split('/');
                const taskId = pathParts[pathParts.length - 1] || '';
                const projectName = pathParts[pathParts.length - 2] || '';
                // Only include worktrees in our worktrees directory
                if (currentPath.includes('/worktrees/')) {
                    worktrees.push({
                        path: currentPath,
                        branch: currentBranch || 'detached',
                        taskId,
                        projectName,
                        exists: fs.existsSync(currentPath)
                    });
                }
                currentPath = '';
                currentBranch = '';
            }
        }
        return worktrees;
    }
    catch {
        return [];
    }
}
/**
 * Check if worktree has uncommitted changes
 */
export function hasUncommittedChanges(worktreePath) {
    try {
        const output = execSync('git status --porcelain', {
            cwd: worktreePath,
            encoding: 'utf-8'
        });
        return output.trim().length > 0;
    }
    catch {
        return false;
    }
}
/**
 * Get worktree info by task ID
 */
export function getWorktreeByTask(projectPath, projectName, taskId) {
    const worktreePath = getWorktreePath(projectName, taskId);
    if (!fs.existsSync(worktreePath)) {
        return null;
    }
    let branch = 'unknown';
    try {
        branch = execSync('git rev-parse --abbrev-ref HEAD', {
            cwd: worktreePath,
            encoding: 'utf-8'
        }).trim();
    }
    catch {
        // ignore
    }
    return {
        path: worktreePath,
        branch,
        taskId,
        projectName,
        exists: true
    };
}
// ============================================
// CLI Command Handlers
// ============================================
export async function worktreeList(projectName) {
    const projectsPath = getRegistryPath('projects.json');
    const projectsData = readJson(projectsPath, { projects: [] });
    const allWorktrees = [];
    for (const project of projectsData.projects) {
        if (projectName && project.name !== projectName)
            continue;
        const worktrees = listWorktrees(project.path);
        allWorktrees.push(...worktrees);
    }
    return {
        success: true,
        worktrees: allWorktrees,
        message: allWorktrees.length === 0
            ? 'No worktrees found'
            : `Found ${allWorktrees.length} worktree(s)`
    };
}
export async function worktreeCreate(projectName, taskId, branch) {
    const projectsPath = getRegistryPath('projects.json');
    const projectsData = readJson(projectsPath, { projects: [] });
    const project = projectsData.projects.find(p => p.name === projectName || p.id === projectName);
    if (!project) {
        return {
            success: false,
            error: 'DW_PROJECT_NOT_FOUND',
            message: `Project '${projectName}' not found`
        };
    }
    try {
        const worktree = createWorktree(project.path, project.name, taskId, branch);
        return {
            success: true,
            worktree,
            message: `Created worktree at ${worktree.path}`
        };
    }
    catch (error) {
        return {
            success: false,
            error: 'DW_WORKTREE_CREATE_FAILED',
            message: String(error)
        };
    }
}
export async function worktreeRemove(projectName, taskId, force = false) {
    const projectsPath = getRegistryPath('projects.json');
    const projectsData = readJson(projectsPath, { projects: [] });
    const project = projectsData.projects.find(p => p.name === projectName || p.id === projectName);
    if (!project) {
        return {
            success: false,
            error: 'DW_PROJECT_NOT_FOUND',
            message: `Project '${projectName}' not found`
        };
    }
    const worktreePath = getWorktreePath(project.name, taskId);
    // Check for uncommitted changes
    if (!force && fs.existsSync(worktreePath) && hasUncommittedChanges(worktreePath)) {
        return {
            success: false,
            error: 'DW_UNCOMMITTED_CHANGES',
            message: 'Worktree has uncommitted changes. Use --force to remove anyway.'
        };
    }
    try {
        const result = removeWorktree(project.path, worktreePath, force);
        return {
            success: result.success,
            message: result.message
        };
    }
    catch (error) {
        return {
            success: false,
            error: 'DW_WORKTREE_REMOVE_FAILED',
            message: String(error)
        };
    }
}
//# sourceMappingURL=worktree.js.map