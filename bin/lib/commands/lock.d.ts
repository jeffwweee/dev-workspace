export declare function claim(options: {
    project?: string;
    task?: string;
    owner?: string;
    ttl?: string;
}): Promise<Record<string, unknown>>;
export declare function release(options: {
    lock?: string;
    all?: boolean;
    owner?: string;
}): Promise<Record<string, unknown>>;
export declare function heartbeat(options: {
    owner?: string;
    lock?: string;
}): Promise<Record<string, unknown>>;
export declare function cleanupLocks(options: {
    force?: boolean;
}): Promise<Record<string, unknown>>;
//# sourceMappingURL=lock.d.ts.map