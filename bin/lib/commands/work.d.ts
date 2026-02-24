interface WorkResult {
    success: boolean;
    error?: string;
    message?: string;
    project?: {
        id: string;
        name: string;
        path: string;
    };
    hasContext?: boolean;
    hasSkills?: boolean;
    skillCount?: number;
    workspaceRoot?: string;
    shellCommand?: string;
}
interface DoneResult {
    success: boolean;
    error?: string;
    message?: string;
    releasedProject?: string | null;
    workspaceRoot?: string;
    shellCommand?: string;
}
export declare function work(projectId: string): Promise<WorkResult>;
export declare function done(): Promise<DoneResult>;
export {};
//# sourceMappingURL=work.d.ts.map