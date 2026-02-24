import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(__dirname, '../../..');
const AUDIT_LOG = path.join(WORKSPACE_ROOT, 'state/audit.log');
// Atomic JSON write operation
export function atomicWrite(filePath, data) {
    const tmpPath = `${filePath}.tmp.${Date.now()}`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmpPath, filePath);
}
// Read JSON file safely
export function readJson(filePath, defaultValue) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content);
    }
    catch {
        return defaultValue;
    }
}
// Get state file paths
export function getStatePath(file) {
    return path.join(WORKSPACE_ROOT, 'state', file);
}
// Get registry file paths
export function getRegistryPath(file) {
    return path.join(WORKSPACE_ROOT, 'registry', file);
}
// Audit logging
export function auditLog(entry) {
    const logLine = JSON.stringify(entry) + '\n';
    fs.appendFileSync(AUDIT_LOG, logLine, 'utf8');
}
// Generate unique ID
export function generateId(prefix) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}-${timestamp}${random}`.toUpperCase();
}
// Get workspace root
export function getWorkspaceRoot() {
    return WORKSPACE_ROOT;
}
// Check if lock is expired
export function isLockExpired(lock) {
    return new Date(lock.expiresAt) < new Date();
}
// Extend lock TTL
export function extendLockTTL(lock, ttlMinutes = 120) {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + ttlMinutes);
    return { ...lock, expiresAt: expiresAt.toISOString() };
}
// ============================================
// Session Management Functions (v2)
// ============================================
const SESSIONS_DIR = path.join(WORKSPACE_ROOT, 'state', 'sessions');
const WORKTREES_BASE = path.join(process.env.HOME || '/home', 'worktrees');
// Ensure sessions directory exists
function ensureSessionsDir() {
    if (!fs.existsSync(SESSIONS_DIR)) {
        fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    }
}
// Get per-session file path
export function getSessionFilePath(sessionId) {
    return path.join(SESSIONS_DIR, `${sessionId}.json`);
}
// Get worktrees base path
export function getWorktreesBase() {
    return WORKTREES_BASE;
}
// Get worktree path for a task
export function getWorktreePath(projectName, taskId) {
    return path.join(WORKTREES_BASE, projectName, taskId);
}
// List all sessions from registry
export function listSessions() {
    const registryPath = getStatePath('sessions.json');
    const registry = readJson(registryPath, {
        sessions: [],
        version: '2.0'
    });
    return registry.sessions;
}
// Get sessions registry
export function getSessionsRegistry() {
    const registryPath = getStatePath('sessions.json');
    return readJson(registryPath, {
        sessions: [],
        version: '2.0'
    });
}
// Save sessions registry
export function saveSessionsRegistry(registry) {
    const registryPath = getStatePath('sessions.json');
    atomicWrite(registryPath, registry);
}
// Get a specific session's full data
export function getSession(sessionId) {
    const sessionPath = getSessionFilePath(sessionId);
    return readJson(sessionPath, null);
}
// Create a new session
export function createSession(sessionId, options) {
    ensureSessionsDir();
    const id = sessionId || generateId('sess');
    const now = new Date().toISOString();
    const session = {
        id,
        project: null,
        currentTask: null,
        worktree: null,
        locks: [],
        prUrl: null,
        tgSessionId: options?.tgSessionId || null,
        tmuxSession: options?.tmuxSession || null,
        status: 'active',
        createdAt: now,
        lastActivity: now
    };
    // Save session file
    atomicWrite(getSessionFilePath(id), session);
    // Add to registry
    const registry = getSessionsRegistry();
    const entry = {
        id,
        projectId: null,
        projectName: null,
        taskId: null,
        worktreePath: null,
        tgSessionId: options?.tgSessionId || null,
        tmuxSession: options?.tmuxSession || null,
        status: 'active',
        createdAt: now,
        lastActivity: now
    };
    registry.sessions.push(entry);
    saveSessionsRegistry(registry);
    // Audit log
    auditLog({
        timestamp: now,
        event: 'session_created',
        sessionId: id,
        data: { action: 'create', tgSessionId: options?.tgSessionId, tmuxSession: options?.tmuxSession }
    });
    return session;
}
// Update session data
export function updateSession(sessionId, updates) {
    const session = getSession(sessionId);
    if (!session)
        return null;
    const updatedSession = {
        ...session,
        ...updates,
        lastActivity: new Date().toISOString()
    };
    atomicWrite(getSessionFilePath(sessionId), updatedSession);
    // Update registry entry
    const registry = getSessionsRegistry();
    const entryIndex = registry.sessions.findIndex(s => s.id === sessionId);
    if (entryIndex >= 0) {
        const entry = registry.sessions[entryIndex];
        registry.sessions[entryIndex] = {
            ...entry,
            projectId: updatedSession.project?.id || null,
            projectName: updatedSession.project?.name || null,
            taskId: updatedSession.currentTask,
            worktreePath: updatedSession.worktree?.path || null,
            tgSessionId: updatedSession.tgSessionId,
            tmuxSession: updatedSession.tmuxSession,
            status: updatedSession.status,
            lastActivity: updatedSession.lastActivity
        };
        saveSessionsRegistry(registry);
    }
    return updatedSession;
}
// Update last activity timestamp
export function updateLastActivity(sessionId) {
    const session = getSession(sessionId);
    if (!session)
        return;
    const now = new Date().toISOString();
    // Update session file
    atomicWrite(getSessionFilePath(sessionId), {
        ...session,
        lastActivity: now
    });
    // Update registry
    const registry = getSessionsRegistry();
    const entryIndex = registry.sessions.findIndex(s => s.id === sessionId);
    if (entryIndex >= 0) {
        registry.sessions[entryIndex].lastActivity = now;
        saveSessionsRegistry(registry);
    }
}
// Delete/end a session
export function deleteSession(sessionId) {
    const sessionPath = getSessionFilePath(sessionId);
    const registry = getSessionsRegistry();
    const entryIndex = registry.sessions.findIndex(s => s.id === sessionId);
    if (entryIndex < 0)
        return false;
    // Mark as ended in registry
    registry.sessions[entryIndex].status = 'ended';
    registry.sessions[entryIndex].lastActivity = new Date().toISOString();
    saveSessionsRegistry(registry);
    // Update session file
    const session = getSession(sessionId);
    if (session) {
        atomicWrite(sessionPath, {
            ...session,
            status: 'ended',
            lastActivity: new Date().toISOString()
        });
    }
    // Audit log
    auditLog({
        timestamp: new Date().toISOString(),
        event: 'session_ended',
        sessionId,
        data: { action: 'end' }
    });
    return true;
}
// Check if session is old (exceeds TTL)
export function isSessionOld(session, ttlHours = 24) {
    const lastActivity = new Date(session.lastActivity);
    const now = new Date();
    const hoursSinceActivity = (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60);
    return hoursSinceActivity > ttlHours;
}
// Get active sessions
export function getActiveSessions() {
    return listSessions().filter(s => s.status === 'active');
}
/**
 * Get current tmux session name
 */
export function getTmuxSessionName() {
    // Check TMUX env var first
    if (!process.env.TMUX)
        return null;
    try {
        const { execSync } = require('child_process');
        const sessionName = execSync('tmux display-message -p "#S"', {
            encoding: 'utf-8'
        }).trim();
        return sessionName || null;
    }
    catch {
        return null;
    }
}
/**
 * Load Telegram sessions config
 */
export function loadTgSessionsConfig() {
    const configPath = path.join(WORKSPACE_ROOT, 'config', 'sessions.json');
    return readJson(configPath, null);
}
/**
 * Find TG session config by tmux session name
 */
export function findTgSessionByTmux(tmuxSession) {
    const config = loadTgSessionsConfig();
    if (!config)
        return null;
    for (const [id, sessionConfig] of Object.entries(config.sessions)) {
        if (sessionConfig.tmux_session === tmuxSession) {
            return { id, config: sessionConfig };
        }
    }
    return null;
}
/**
 * Detect session context from environment
 * Returns TG session ID and config if in a mapped tmux session
 */
export function detectSessionContext() {
    const tmuxSession = getTmuxSessionName();
    if (!tmuxSession) {
        return { tmuxSession: null, tgSessionId: null, tgConfig: null };
    }
    const match = findTgSessionByTmux(tmuxSession);
    if (!match) {
        return { tmuxSession, tgSessionId: null, tgConfig: null };
    }
    return {
        tmuxSession,
        tgSessionId: match.id,
        tgConfig: match.config
    };
}
//# sourceMappingURL=manager.js.map