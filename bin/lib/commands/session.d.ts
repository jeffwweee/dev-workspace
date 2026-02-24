import { type SessionData } from '../state/manager.js';
interface SessionDisplay {
    id: string;
    projectName: string | null;
    taskId: string | null;
    status: string;
    createdAt: string;
    lastActivity: string;
    isOld: boolean;
}
/**
 * List all sessions
 */
export declare function listSessionsCmd(showAll?: boolean): Promise<{
    success: boolean;
    sessions: SessionDisplay[];
    count: number;
}>;
/**
 * End a session
 */
export declare function endSession(sessionId: string | undefined, force?: boolean): Promise<{
    success: boolean;
    error?: string;
    message?: string;
    session?: SessionData;
}>;
/**
 * Update session activity (heartbeat)
 */
export declare function sessionHeartbeat(sessionId: string | undefined): Promise<{
    success: boolean;
    error?: string;
    message?: string;
    session?: SessionData;
}>;
export {};
//# sourceMappingURL=session.d.ts.map