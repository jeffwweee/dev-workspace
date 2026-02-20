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
//# sourceMappingURL=manager.d.ts.map