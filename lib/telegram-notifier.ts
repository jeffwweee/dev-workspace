import * as https from 'https';
import { getBotByRole } from './orchestration-config';

export interface NotifyResult {
  success: boolean;
  messageId?: number;
  error?: string;
}

/**
 * Sends a Telegram message
 */
export async function sendMessage(chatId: number | string, text: string, options: { parseMode?: string } = {}): Promise<NotifyResult> {
  const bot = getBotByRole('orchestrator');

  if (!bot || !bot.token) {
    return { success: false, error: 'orchestrator bot not configured' };
  }

  const body = JSON.stringify({
    chat_id: chatId,
    text,
    parse_mode: options.parseMode || 'Markdown'
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${bot.token}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.ok) {
            resolve({ success: true, messageId: result.result.message_id });
          } else {
            resolve({ success: false, error: result.description });
          }
        } catch (e) {
          resolve({ success: false, error: 'Failed to parse response' });
        }
      });
    });

    req.on('error', (e) => resolve({ success: false, error: e.message }));
    req.write(body);
    req.end();
  });
}

/**
 * Notifies about blocked task
 */
export async function notifyBlocked(task: { id: string }, agent: string, reason: string): Promise<NotifyResult> {
  const bot = getBotByRole('orchestrator');
  const adminChat = bot?.permissions?.admin_users?.[0];

  if (!adminChat) {
    return { success: false, error: 'No admin chat configured' };
  }

  const text = `⚠️ *Task Blocked*

**Task:** \`${task.id}\`
**Agent:** ${agent}
**Reason:** ${reason}
**Time:** ${new Date().toISOString()}

Action required: Review and decide to retry, reassign, or abort.`;

  return sendMessage(adminChat, text);
}

/**
 * Notifies about failed task
 */
export async function notifyFailed(task: { id: string }, agent: string, error: string): Promise<NotifyResult> {
  const bot = getBotByRole('orchestrator');
  const adminChat = bot?.permissions?.admin_users?.[0];

  if (!adminChat) {
    return { success: false, error: 'No admin chat configured' };
  }

  const text = `❌ *Task Failed*

**Task:** \`${task.id}\`
**Agent:** ${agent}
**Error:** ${error}
**Time:** ${new Date().toISOString()}

Retries exhausted. Manual intervention required.`;

  return sendMessage(adminChat, text);
}

/**
 * Notifies about task completion
 */
export async function notifyComplete(task: { id: string }, workflow: string, duration: string): Promise<NotifyResult> {
  const bot = getBotByRole('orchestrator');
  const adminChat = bot?.permissions?.admin_users?.[0];

  if (!adminChat) {
    return { success: false, error: 'No admin chat configured' };
  }

  const text = `✅ *Task Complete*

**Task:** \`${task.id}\`
**Pipeline:** ${workflow}
**Duration:** ${duration}
**Time:** ${new Date().toISOString()}

All pipeline stages completed successfully.`;

  return sendMessage(adminChat, text);
}

/**
 * Notifies about agent conflict
 */
export async function notifyAgentConflict(
  task: { id: string },
  agentType: string,
  occupiedBy: string,
  queueLength: number
): Promise<NotifyResult> {
  const bot = getBotByRole('orchestrator');
  const adminChat = bot?.permissions?.admin_users?.[0];

  if (!adminChat) {
    return { success: false, error: 'No admin chat configured' };
  }

  const text = `⚠️ *Agent Assignment Conflict*

**Task:** \`${task.id}\`
**Needs:** ${agentType}-agent
**Status:** OCCUPIED by ${occupiedBy}
**Queue:** ${queueLength} task(s) ahead

Options:
[A] Wait in queue
[B] Spawn adhoc agent (uses extra resources)`;

  return sendMessage(adminChat, text);
}

/**
 * Notifies about review rejection
 */
export async function notifyReviewRejected(
  task: { id: string },
  confidence: number,
  threshold: number,
  issues: string[]
): Promise<NotifyResult> {
  const bot = getBotByRole('orchestrator');
  const adminChat = bot?.permissions?.admin_users?.[0];

  if (!adminChat) {
    return { success: false, error: 'No admin chat configured' };
  }

  const issuesList = issues.map(i => `  • ${i}`).join('\n');

  const text = `🔍 *Review Rejected*

**Task:** \`${task.id}\`
**Confidence:** ${confidence} (threshold: ${threshold})

**Issues Found:**
${issuesList}

Action: Code needs revision before proceeding.`;

  return sendMessage(adminChat, text);
}
