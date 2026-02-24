import { type SessionData } from '../state/manager.js';
export interface InitResult {
    success: boolean;
    action: 'created' | 'resumed' | 'picker';
    session?: SessionData;
    sessions?: SessionPickerEntry[];
    tgSession?: {
        id: string;
        botUsername: string;
        purpose: string;
    };
    error?: string;
    message?: string;
}
export interface SessionPickerEntry {
    id: string;
    projectName: string | null;
    taskId: string | null;
    tgSessionId: string | null;
    tmuxSession: string | null;
    status: string;
    lastActivity: string;
    isOld: boolean;
    ageHours: number;
}
/**
 * Initialize or resume a session
 *
 * Modes:
 * - No sessions exist: create new (auto-detect tmux/tg session)
 * - Sessions exist but no selection: return picker data
 * - --new flag: create new session (auto-detect tmux/tg session)
 * - --resume <id>: resume specific session
 */
export declare function init(options: {
    new?: boolean;
    resume?: string;
}): Promise<InitResult>;
/**
 * Create a new session (wrapper for backward compatibility)
 */
export declare function newSession(): Promise<InitResult>;
/**
 * Resume a session by ID
 */
export declare function resumeSession(sessionId: string): Promise<InitResult>;
//# sourceMappingURL=init.d.ts.map