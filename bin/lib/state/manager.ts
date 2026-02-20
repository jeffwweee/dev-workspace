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
