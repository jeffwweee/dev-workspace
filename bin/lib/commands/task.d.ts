export declare function pickNext(options: {
    project?: string;
}): Promise<Record<string, unknown>>;
export declare function recordResult(options: {
    task: string;
    status: string;
    files?: string;
    summary?: string;
}): Promise<Record<string, unknown>>;
export declare function showQueue(): Promise<Record<string, unknown>>;
//# sourceMappingURL=task.d.ts.map