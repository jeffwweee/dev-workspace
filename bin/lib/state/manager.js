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
//# sourceMappingURL=manager.js.map