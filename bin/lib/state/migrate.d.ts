/**
 * Check if migration has already been done
 */
export declare function isMigrated(): boolean;
/**
 * Migrate from v1 (single session in active.json) to v2 (sessions registry)
 *
 * This creates:
 * - state/sessions.json (registry)
 * - state/sessions/SESS-XXX.json (per-session data)
 */
export declare function migrateToV2(): {
    success: boolean;
    message: string;
    sessionIds?: string[];
};
/**
 * Auto-migrate if needed (call this at startup)
 */
export declare function ensureV2(): void;
//# sourceMappingURL=migrate.d.ts.map