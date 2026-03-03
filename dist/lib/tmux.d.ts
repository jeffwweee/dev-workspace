export interface TmuxTarget {
    session: string;
    window: number;
    pane: number;
}
/**
 * Format tmux target string
 */
export declare function formatTmuxTarget(target: TmuxTarget): string;
/**
 * Inject command into tmux session
 * @param target - Tmux target (session, window, pane)
 * @param command - Command to inject (will be followed by Enter)
 * @param delayMs - Delay in ms before sending Enter (default: 5000ms)
 * @throws Error if tmux command fails
 */
export declare function injectTmuxCommand(target: TmuxTarget, command: string, delayMs?: number): Promise<void>;
/**
 * Check if tmux session exists
 */
export declare function sessionExists(sessionName: string): Promise<boolean>;
/**
 * Synchronous version for use in spawn routines
 * @param target - Tmux target (session, window, pane)
 * @param command - Command to inject (will be followed by Enter)
 * @param delayMs - Delay in ms before sending Enter (default: 5000ms)
 */
export declare function injectTmuxCommandSync(target: TmuxTarget, command: string, delayMs?: number): void;
//# sourceMappingURL=tmux.d.ts.map