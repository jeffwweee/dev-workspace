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
export interface Session {
    sessionId: string | null;
    activeProject: string | null;
    startTime: string | null;
    status: 'active' | 'inactive';
}
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
    tgSessionId: string | null;
    tmuxSession: string | null;
    status: 'active' | 'ended';
    createdAt: string;
    lastActivity: string;
}
export interface SessionRegistryEntry {
    id: string;
    projectId: string | null;
    projectName: string | null;
    taskId: string | null;
    worktreePath: string | null;
    tgSessionId: string | null;
    tmuxSession: string | null;
    status: 'active' | 'ended';
    createdAt: string;
    lastActivity: string;
}
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
export declare function atomicWrite(filePath: string, data: unknown): void;
export declare function readJson<T>(filePath: string, defaultValue: T): T;
export declare function getStatePath(file: string): string;
export declare function getRegistryPath(file: string): string;
export declare function auditLog(entry: AuditEntry): void;
export declare function generateId(prefix: string): string;
export declare function getWorkspaceRoot(): string;
export declare function isLockExpired(lock: Lock): boolean;
export declare function extendLockTTL(lock: Lock, ttlMinutes?: number): Lock;
export declare function getSessionFilePath(sessionId: string): string;
export declare function getWorktreesBase(): string;
export declare function getWorktreePath(projectName: string, taskId: string): string;
export declare function listSessions(): SessionRegistryEntry[];
export declare function getSessionsRegistry(): SessionsRegistry;
export declare function saveSessionsRegistry(registry: SessionsRegistry): void;
export declare function getSession(sessionId: string): SessionData | null;
export declare function createSession(sessionId?: string, options?: {
    tgSessionId?: string;
    tmuxSession?: string;
}): SessionData;
export declare function updateSession(sessionId: string, updates: Partial<SessionData>): SessionData | null;
export declare function updateLastActivity(sessionId: string): void;
export declare function deleteSession(sessionId: string): boolean;
export declare function isSessionOld(session: SessionRegistryEntry, ttlHours?: number): boolean;
export declare function getActiveSessions(): SessionRegistryEntry[];
export interface TgSessionConfig {
    name: string;
    bot_token_env: string;
    bot_username: string;
    chat_ids: number[];
    allowed_users: number[];
    tmux_session: string;
    tmux_wake_command: string;
    purpose: string;
}
export interface TgSessionsConfig {
    sessions: Record<string, TgSessionConfig>;
    default: string;
}
/**
 * Get current tmux session name
 */
export declare function getTmuxSessionName(): string | null;
/**
 * Load Telegram sessions config
 */
export declare function loadTgSessionsConfig(): TgSessionsConfig | null;
/**
 * Find TG session config by tmux session name
 */
export declare function findTgSessionByTmux(tmuxSession: string): {
    id: string;
    config: TgSessionConfig;
} | null;
/**
 * Detect session context from environment
 * Returns TG session ID and config if in a mapped tmux session
 */
export declare function detectSessionContext(): {
    tmuxSession: string | null;
    tgSessionId: string | null;
    tgConfig: TgSessionConfig | null;
};
//# sourceMappingURL=manager.d.ts.map