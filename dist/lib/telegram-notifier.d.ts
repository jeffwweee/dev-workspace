export interface NotifyResult {
    success: boolean;
    messageId?: number;
    error?: string;
}
/**
 * Sends a Telegram message
 */
export declare function sendMessage(chatId: number | string, text: string, options?: {
    parseMode?: string;
}): Promise<NotifyResult>;
/**
 * Notifies about blocked task
 */
export declare function notifyBlocked(task: {
    id: string;
}, agent: string, reason: string): Promise<NotifyResult>;
/**
 * Notifies about failed task
 */
export declare function notifyFailed(task: {
    id: string;
}, agent: string, error: string): Promise<NotifyResult>;
/**
 * Notifies about task completion
 */
export declare function notifyComplete(task: {
    id: string;
}, workflow: string, duration: string): Promise<NotifyResult>;
/**
 * Notifies about agent conflict
 */
export declare function notifyAgentConflict(task: {
    id: string;
}, agentType: string, occupiedBy: string, queueLength: number): Promise<NotifyResult>;
/**
 * Notifies about review rejection
 */
export declare function notifyReviewRejected(task: {
    id: string;
}, confidence: number, threshold: number, issues: string[]): Promise<NotifyResult>;
//# sourceMappingURL=telegram-notifier.d.ts.map