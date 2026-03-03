#!/usr/bin/env node
/**
 * Agent Notify CLI
 *
 * Sends agent-identity-aware notifications via Telegram through assigned bot.
 *
 * Usage:
 *   agent-notify assignment TASK-XXX
 *   agent-notify complete TASK-XXX [--details]
 *   agent-notify help "<reason>" [--task TASK-XXX]
 *   agent-notify status "<message>" [--task TASK-XXX]
 */
import { Command } from 'commander';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = path.join(__dirname, '..', 'config', 'orchestration.yml');
/**
 * Load orchestration config
 */
function loadConfig() {
    const content = fs.readFileSync(CONFIG_PATH, 'utf-8');
    return yaml.load(content);
}
/**
 * Get bot by role
 */
function getBotByRole(role, config) {
    return config.bots.find(b => b.role === role);
}
/**
 * Detect current agent role from environment
 * Checks AGENT_ROLE env var, or derives from agent name
 */
function detectAgentRole() {
    // Check environment variable first
    if (process.env.AGENT_ROLE) {
        return process.env.AGENT_ROLE;
    }
    // Check AGENT_NAME and map to role
    const agentName = process.env.AGENT_NAME || process.env.CLAUDE_AGENT_NAME;
    if (agentName) {
        const roleMap = {
            'pichu': 'orchestrator',
            'pikachu': 'backend',
            'raichu': 'frontend',
            'bulbasaur': 'qa',
            'charmander': 'review-git',
        };
        return roleMap[agentName] || agentName;
    }
    // Fallback: Check tmux session name
    try {
        const sessionOutput = execSync('tmux display-message -p "#S" 2>/dev/null', { encoding: 'utf-8' });
        const sessionName = sessionOutput.trim();
        // cc-backend -> backend, cc-qa -> qa, cc-orchestrator -> orchestrator, etc.
        const roleMatch = sessionName.match(/^cc-(.+)$/);
        if (roleMatch) {
            return roleMatch[1];
        }
    }
    catch {
        // tmux not available or not in a session
    }
    // Default to orchestrator
    return 'orchestrator';
}
/**
 * Get agent name from role
 */
function getAgentName(role) {
    const nameMap = {
        'orchestrator': 'Pichu',
        'backend': 'Pikachu',
        'frontend': 'Raichu',
        'qa': 'Bulbasaur',
        'review-git': 'Charmander',
    };
    return nameMap[role] || role.charAt(0).toUpperCase() + role.slice(1);
}
/**
 * Escape text for MarkdownV2
 */
function escapeMarkdownV2(text) {
    let escaped = text.replace(/\\/g, '\\\\');
    const specialChars = ['_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!'];
    for (const char of specialChars) {
        escaped = escaped.replace(new RegExp(`\\${char}`, 'g'), `\\${char}`);
    }
    return escaped;
}
/**
 * Read task file
 */
function readTaskFile(taskId, role) {
    const taskPath = path.join(__dirname, '..', 'state', 'pending', `${role}-${taskId}.md`);
    if (!fs.existsSync(taskPath)) {
        return null;
    }
    const content = fs.readFileSync(taskPath, 'utf-8');
    const match = content.match(/^#\s+TASK-\d+:\s*(.+)$/m);
    return match ? { title: match[1] } : null;
}
/**
 * Read progress file
 */
function readProgressFile(taskId) {
    const progressPath = path.join(__dirname, '..', 'state', 'progress', `${taskId}.md`);
    if (!fs.existsSync(progressPath)) {
        return null;
    }
    const content = fs.readFileSync(progressPath, 'utf-8');
    // Parse summary section
    const summaryMatch = content.match(/## Summary\n\n(.+?)(?=\n##|\n*$)/s);
    const summary = summaryMatch ? summaryMatch[1].trim() : '';
    // Parse files changed
    const filesMatch = content.match(/## Files Changed\n\n(.+?)(?=\n##|\n*$)/s);
    const files = filesMatch ? filesMatch[1].trim().split('\n').map(f => f.replace(/^-\s*/, '')) : [];
    // Parse agent
    const agentMatch = content.match(/\*\*Agent:\*\*\s*(\w+)/);
    const agent = agentMatch ? agentMatch[1] : '';
    return { summary, files, agent, content };
}
/**
 * Publish message to Redis outbox
 */
async function publishToOutbox(botId, chatId, text, parseMode = 'MarkdownV2') {
    const redis = await import('ioredis');
    const client = new redis.default(process.env.REDIS_URL || 'redis://localhost:6379');
    const message = JSON.stringify({
        bot_id: botId,
        chat_id: chatId,
        text: text,
        parse_mode: parseMode,
    });
    await client.publish('tg:outbox', message);
    await client.quit();
}
/**
 * Format and send notification
 */
async function sendNotification(type, options) {
    const config = loadConfig();
    const role = detectAgentRole();
    const bot = getBotByRole(role, config);
    if (!bot) {
        console.error(`No bot configured for role: ${role}`);
        process.exit(1);
    }
    const agentName = getAgentName(role);
    const chatId = bot.permissions?.admin_users?.[0] || 195061634;
    const botId = bot.name;
    let text = '';
    switch (type) {
        case 'assignment': {
            const task = readTaskFile(options.taskId, role);
            const title = task ? task.title : 'Unknown task';
            text = `📥 ${agentName} received ${role} task ${options.taskId}\n\n${escapeMarkdownV2(title)}`;
            break;
        }
        case 'complete': {
            if (options.details) {
                const progress = readProgressFile(options.taskId);
                const summary = progress?.summary || 'Task completed';
                const files = progress?.files || [];
                const filesList = files.map((f) => `  • ${escapeMarkdownV2(f)}`).join('\n');
                text = `✅ ${agentName} completed ${options.taskId}\n\n${escapeMarkdownV2(summary)}\n\n${filesList ? '*Files changed:*\n' + filesList : ''}`;
            }
            else {
                text = `✅ ${agentName} completed ${options.taskId}`;
            }
            break;
        }
        case 'help': {
            text = `🆘 ${agentName} needs help\n\n${escapeMarkdownV2(options.reason)}`;
            if (options.task) {
                const task = readTaskFile(options.task, role);
                if (task) {
                    text += `\n\n_Task: ${escapeMarkdownV2(options.task)} - ${escapeMarkdownV2(task.title)}_`;
                }
            }
            break;
        }
        case 'status': {
            text = `🔄 ${agentName} status update\n\n${escapeMarkdownV2(options.message)}`;
            if (options.task) {
                text += `\n\n_Task: ${escapeMarkdownV2(options.task)}_`;
            }
            break;
        }
        default:
            console.error(`Unknown notification type: ${type}`);
            process.exit(1);
    }
    await publishToOutbox(botId, chatId, text);
    console.log(`Notification sent via ${botId}`);
}
const program = new Command();
program
    .name('agent-notify')
    .description('Send agent-identity-aware notifications via Telegram')
    .version('1.0.0');
program.command('assignment <taskId>')
    .description('Notify about task assignment')
    .action(async (taskId) => {
    await sendNotification('assignment', { taskId });
});
program.command('complete <taskId>')
    .description('Notify about task completion')
    .option('-d, --details', 'Include detailed summary')
    .action(async (taskId, options) => {
    await sendNotification('complete', { taskId, details: options.details });
});
program.command('help <reason>')
    .description('Request assistance')
    .option('-t, --task <taskId>', 'Related task ID')
    .action(async (reason, options) => {
    await sendNotification('help', { reason, task: options.task });
});
program.command('status <message>')
    .description('Send status update')
    .option('-t, --task <taskId>', 'Related task ID')
    .action(async (message, options) => {
    await sendNotification('status', { message, task: options.task });
});
program.parse();
//# sourceMappingURL=agent-notify.js.map