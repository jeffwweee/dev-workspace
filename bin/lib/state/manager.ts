import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(__dirname, '../../..');
const AUDIT_LOG = path.join(WORKSPACE_ROOT, 'state/audit.log');

export interface Lock {
  lockId: string;
  projectId?: string;
  taskId?: string;
  ownerId: string;
  acquiredAt: string;
  expiresAt: string;
  status: 'active' | 'expired' | 'released';
}

export interface Project {
  id: string;
  name: string;
  path: string;
  remote?: string;
  addedAt: string;
  lastAccessed?: string;
}

// Legacy session interface (v1 - for migration)
export interface Session {
  sessionId: string | null;
  activeProject: string | null;
  startTime: string | null;
  status: 'active' | 'inactive';
}

// Per-session state (v2)
export interface SessionWorktree {
  path: string;
  branch: string;
  createdAt: string;
}

export interface SessionData {
  id: string;
  project: {
    id: string;
    name: string;
    path: string;
  } | null;
  currentTask: string | null;
  worktree: SessionWorktree | null;
  locks: string[];
  prUrl: string | null;
  status: 'active' | 'ended';
  createdAt: string;
  lastActivity: string;
}

// Session registry entry (for sessions.json)
export interface SessionRegistryEntry {
  id: string;
  projectId: string | null;
  projectName: string | null;
  taskId: string | null;
  worktreePath: string | null;
  status: 'active' | 'ended';
  createdAt: string;
  lastActivity: string;
}

// Sessions registry (sessions.json)
export interface SessionsRegistry {
  sessions: SessionRegistryEntry[];
  version: string;
}

export interface QueueItem {
  taskId: string;
  projectId: string;
  title: string;
  priority: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  addedAt: string;
}

export interface ProjectsData {
  projects: Project[];
  version?: string;
  lastUpdated?: string | null;
}

export interface AuditEntry {
  timestamp: string;
  event: string;
  sessionId: string;
  data: Record<string, unknown>;
}

// Atomic JSON write operation
export function atomicWrite(filePath: string, data: unknown): void {
  const tmpPath = `${filePath}.tmp.${Date.now()}`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpPath, filePath);
}

// Read JSON file safely
export function readJson<T>(filePath: string, defaultValue: T): T {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content) as T;
  } catch {
    return defaultValue;
  }
}

// Get state file paths
export function getStatePath(file: string): string {
  return path.join(WORKSPACE_ROOT, 'state', file);
}

// Get registry file paths
export function getRegistryPath(file: string): string {
  return path.join(WORKSPACE_ROOT, 'registry', file);
}

// Audit logging
export function auditLog(entry: AuditEntry): void {
  const logLine = JSON.stringify(entry) + '\n';
  fs.appendFileSync(AUDIT_LOG, logLine, 'utf8');
}

// Generate unique ID
export function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}${random}`.toUpperCase();
}

// Get workspace root
export function getWorkspaceRoot(): string {
  return WORKSPACE_ROOT;
}

// Check if lock is expired
export function isLockExpired(lock: Lock): boolean {
  return new Date(lock.expiresAt) < new Date();
}

// Extend lock TTL
export function extendLockTTL(lock: Lock, ttlMinutes: number = 120): Lock {
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
function ensureSessionsDir(): void {
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  }
}

// Get per-session file path
export function getSessionFilePath(sessionId: string): string {
  return path.join(SESSIONS_DIR, `${sessionId}.json`);
}

// Get worktrees base path
export function getWorktreesBase(): string {
  return WORKTREES_BASE;
}

// Get worktree path for a task
export function getWorktreePath(projectName: string, taskId: string): string {
  return path.join(WORKTREES_BASE, projectName, taskId);
}

// List all sessions from registry
export function listSessions(): SessionRegistryEntry[] {
  const registryPath = getStatePath('sessions.json');
  const registry = readJson<SessionsRegistry>(registryPath, {
    sessions: [],
    version: '2.0'
  });
  return registry.sessions;
}

// Get sessions registry
export function getSessionsRegistry(): SessionsRegistry {
  const registryPath = getStatePath('sessions.json');
  return readJson<SessionsRegistry>(registryPath, {
    sessions: [],
    version: '2.0'
  });
}

// Save sessions registry
export function saveSessionsRegistry(registry: SessionsRegistry): void {
  const registryPath = getStatePath('sessions.json');
  atomicWrite(registryPath, registry);
}

// Get a specific session's full data
export function getSession(sessionId: string): SessionData | null {
  const sessionPath = getSessionFilePath(sessionId);
  return readJson<SessionData | null>(sessionPath, null);
}

// Create a new session
export function createSession(sessionId?: string): SessionData {
  ensureSessionsDir();

  const id = sessionId || generateId('sess');
  const now = new Date().toISOString();

  const session: SessionData = {
    id,
    project: null,
    currentTask: null,
    worktree: null,
    locks: [],
    prUrl: null,
    status: 'active',
    createdAt: now,
    lastActivity: now
  };

  // Save session file
  atomicWrite(getSessionFilePath(id), session);

  // Add to registry
  const registry = getSessionsRegistry();
  const entry: SessionRegistryEntry = {
    id,
    projectId: null,
    projectName: null,
    taskId: null,
    worktreePath: null,
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
    data: { action: 'create' }
  });

  return session;
}

// Update session data
export function updateSession(sessionId: string, updates: Partial<SessionData>): SessionData | null {
  const session = getSession(sessionId);
  if (!session) return null;

  const updatedSession: SessionData = {
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
      status: updatedSession.status,
      lastActivity: updatedSession.lastActivity
    };
    saveSessionsRegistry(registry);
  }

  return updatedSession;
}

// Update last activity timestamp
export function updateLastActivity(sessionId: string): void {
  const session = getSession(sessionId);
  if (!session) return;

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
export function deleteSession(sessionId: string): boolean {
  const sessionPath = getSessionFilePath(sessionId);
  const registry = getSessionsRegistry();
  const entryIndex = registry.sessions.findIndex(s => s.id === sessionId);

  if (entryIndex < 0) return false;

  // Mark as ended in registry
  registry.sessions[entryIndex].status = 'ended';
  registry.sessions[entryIndex].lastActivity = new Date().toISOString();
  saveSessionsRegistry(registry);

  // Update session file
  const session = getSession(sessionId);
  if (session) {
    atomicWrite(sessionPath, {
      ...session,
      status: 'ended' as const,
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
export function isSessionOld(session: SessionRegistryEntry, ttlHours: number = 24): boolean {
  const lastActivity = new Date(session.lastActivity);
  const now = new Date();
  const hoursSinceActivity = (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60);
  return hoursSinceActivity > ttlHours;
}

// Get active sessions
export function getActiveSessions(): SessionRegistryEntry[] {
  return listSessions().filter(s => s.status === 'active');
}
