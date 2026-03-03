import { spawnAgent, isAgentRunning, sendToAgent, listAgentSessions, getCoreAgents } from './spawn-agent';
import { enqueueTask, dequeueTask, getQueueLength } from './queue-manager';
import { createProgressFile, readProgressFile } from './memory-manager';
import { STATUS_COMPLETE, STATUS_ISSUES_FOUND, STATUS_FAILED, STATUS_BLOCKED } from './status-constants.js';
import { createHandoff, saveHandoff } from './handoff';
import { loadConfig, getWorkflow, getBotByRole } from './orchestration-config';
import { injectTmuxCommand } from './tmux';
import Redis from 'ioredis';
const state = {
    isRunning: false,
    loopCount: 0,
    activeTasks: new Map(),
    lastSync: null
};
// Global Redis client for Telegram inbox polling
let redisClient = null;
/**
 * Initializes the orchestrator
 */
export async function initialize() {
    console.log('[Orchestrator] Initializing...');
    // Ensure core agents are running
    for (const agent of getCoreAgents()) {
        if (!isAgentRunning(agent)) {
            console.log(`[Orchestrator] Spawning ${agent} agent...`);
            const botConfig = getBotByRole(agent);
            const roleSkill = botConfig?.agent_config?.role_skill;
            spawnAgent({
                name: agent,
                persona: botConfig?.agent_config?.persona,
                role: roleSkill,
                memoryFile: botConfig?.agent_config?.memory,
                model: 'sonnet'
            });
        }
        else {
            console.log(`[Orchestrator] ${agent} agent already running`);
        }
    }
    state.isRunning = true;
    console.log('[Orchestrator] Initialized with agents:', listAgentSessions());
}
/**
 * Main orchestrator loop
 */
export async function runLoop() {
    const config = loadConfig();
    // Initialize Redis client for Telegram inbox polling
    redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    // Create consumer group for inbox stream if not exists
    try {
        await redisClient.xgroup('CREATE', 'tg:inbox', 'orchestrator-consumer', '$', 'MKSTREAM');
        console.log('[Orchestrator] Created Redis consumer group: orchestrator-consumer');
    }
    catch (e) {
        if (!e.message.includes('BUSYGROUP')) {
            console.error('[Orchestrator] Consumer group creation error:', e.message);
        }
    }
    console.log('[Orchestrator] Redis inbox polling ready');
    while (state.isRunning) {
        state.loopCount++;
        console.log(`\n[Orchestrator] Loop ${state.loopCount} - ${new Date().toISOString()}`);
        try {
            // 1. Poll Telegram inbox for pichu (NEW - event-driven)
            await checkTelegramInbox();
            // 2. Check entry points (queues, files, etc.)
            await checkEntryPoints();
            // 3. Monitor active tasks
            await monitorActiveTasks();
            // 4. Process queue assignments
            await processQueues();
        }
        catch (error) {
            console.error('[Orchestrator] Loop error:', error);
        }
        // Sleep until next iteration
        await sleep(config.orchestrator.loop_interval_ms);
    }
    // Cleanup
    if (redisClient) {
        await redisClient.quit();
        redisClient = null;
    }
}
/**
 * Checks Telegram inbox for messages to pichu (orchestrator)
 * Polls Redis stream and injects to pichu's tmux session
 */
async function checkTelegramInbox() {
    if (!redisClient) {
        return;
    }
    try {
        // Use XREADGROUP to claim messages (consumer group pattern)
        const messages = await redisClient.call('XREADGROUP', 'GROUP', 'orchestrator-consumer', 'tg:inbox', 'COUNT', '1', 'STREAMS', 'tg:inbox', '>');
        if (!messages) {
            return;
        }
        // Parse response: [[stream, [[id, [field, value, ...]], ...]]
        const response = messages;
        for (const [stream, entries] of response) {
            if (!entries || entries.length === 0)
                continue;
            for (const entry of entries) {
                const messageId = entry[0];
                const fields = entry[1];
                // Parse fields into key-value pairs
                const data = {};
                for (let i = 0; i < fields.length; i += 2) {
                    data[fields[i]] = fields[i + 1];
                }
                const botId = data.bot_id || data.botId;
                const chatId = data.chat_id || data.chatId;
                const text = data.text;
                // Only route messages meant for orchestrator (pichu)
                if (botId !== 'pichu') {
                    continue;
                }
                console.log(`[Orchestrator] Received message for pichu from chat ${chatId}`);
                // Store message context in Redis for telegram-reply to use
                const contextKey = `tg:context:${chatId}:${messageId}`;
                await redisClient.hset(contextKey, {
                    botId,
                    chatId,
                    messageId,
                    userId: data.user_id || data.userId || 'unknown',
                    timestamp: Date.now().toString()
                });
                await redisClient.expire(contextKey, 3600); // 1 hour TTL
                // Inject to pichu's tmux session (orchestrator session)
                const escapedText = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
                const injectCmd = `/commander --message "${escapedText}"`;
                await injectTmuxCommand({ session: 'cc-orchestrator', window: 0, pane: 0 }, injectCmd);
                console.log(`[Orchestrator] Injected message to pichu`);
                // Acknowledge the message
                await redisClient.xack('tg:inbox', 'orchestrator-consumer', messageId);
            }
        }
    }
    catch (error) {
        // Non-blocking error - continue orchestrator loop
        console.error('[Orchestrator] Telegram inbox check error:', error);
    }
}
/**
 * Checks entry points for new tasks
 */
async function checkEntryPoints() {
    // Check each agent's queue for new tasks
    for (const agent of getCoreAgents()) {
        const queueLength = getQueueLength(agent);
        if (queueLength > 0) {
            // Check if agent is busy
            const busyWithTask = [...state.activeTasks.values()].find(t => t.agent === agent);
            if (!busyWithTask) {
                const task = dequeueTask(agent);
                if (task) {
                    await assignTask(agent, task);
                }
            }
        }
    }
}
/**
 * Assigns a task to an agent
 */
async function assignTask(agent, task) {
    // Validate task has required id field
    if (!task.id) {
        console.error('[Orchestrator] Task missing id field:', JSON.stringify(task));
        return;
    }
    const sessionName = `cc-${agent}`;
    const config = loadConfig();
    const botConfig = getBotByRole(agent);
    console.log(`[Orchestrator] Assigning ${task.id} to ${agent}`);
    // Create progress file
    createProgressFile(agent, task.id, {
        description: task.planPath || task.handoffPath || `Task ${task.id}`
    });
    // Track as active
    state.activeTasks.set(task.id, {
        agent,
        status: 'IN_PROGRESS',
        started: new Date().toISOString(),
        workflow: task.workflow
    });
    // Build injection command (always use --auto for automated pipeline)
    let injectCmd = '';
    if (task.handoffPath) {
        injectCmd = `/plan-execute --auto --handoff ${task.handoffPath}`;
    }
    else if (task.planPath) {
        injectCmd = `/plan-execute --auto --plan ${task.planPath}`;
    }
    else {
        injectCmd = `/plan-execute --auto --task ${task.id}`;
    }
    // Inject task to agent tmux
    try {
        await injectTmuxCommand({ session: sessionName, window: 0, pane: 0 }, injectCmd);
    }
    catch (error) {
        console.error(`[Orchestrator] Failed to inject to ${sessionName}:`, error);
        return;
    }
    // Note: Agents notify themselves via agent-notify.ts - no orchestrator notification needed
}
/**
 * Sends a notification via gateway /reply endpoint
 */
async function sendNotification(text) {
    const orchestratorBot = getBotByRole('orchestrator');
    const adminChat = orchestratorBot?.permissions?.admin_users?.[0];
    if (!adminChat) {
        console.warn('[Orchestrator] No admin chat configured for notifications');
        return;
    }
    try {
        const response = await fetch('http://localhost:3100/reply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                bot_id: 'pichu',
                chat_id: adminChat,
                text
            })
        });
        if (!response.ok) {
            console.error('[Orchestrator] Failed to send notification:', await response.text());
        }
    }
    catch (error) {
        console.error('[Orchestrator] Notification error:', error);
    }
}
/**
 * Monitors active tasks
 */
async function monitorActiveTasks() {
    for (const [taskId, taskInfo] of state.activeTasks) {
        const progress = readProgressFile(taskInfo.agent, taskId);
        if (!progress) {
            console.log(`[Orchestrator] No progress file for ${taskId}`);
            continue;
        }
        console.log(`[Orchestrator] Task ${taskId}: ${progress.status}`);
        if (progress.status === STATUS_COMPLETE) {
            await handleTaskComplete(taskId, taskInfo);
        }
        else if (progress.status === STATUS_ISSUES_FOUND) {
            await handleIssuesFound(taskId, taskInfo);
        }
        else if (progress.status === STATUS_BLOCKED) {
            console.log(`[Orchestrator] Task ${taskId} blocked`);
        }
        else if (progress.status === STATUS_FAILED) {
            await handleTaskFailed(taskId, taskInfo);
        }
    }
}
/**
 * Handles task completion
 */
async function handleTaskComplete(taskId, taskInfo) {
    console.log(`[Orchestrator] Task ${taskId} completed by ${taskInfo.agent}`);
    // Special case: git-decision task complete → mark original task as fully complete
    if (taskId.endsWith('-git-decision')) {
        const originalTaskId = taskId.replace('-git-decision', '');
        console.log(`[Orchestrator] Git decision complete for ${originalTaskId}`);
        console.log(`[Orchestrator] Task ${originalTaskId} fully complete!`);
        // Send completion notification with original task ID
        await sendNotification(`✅ ${originalTaskId} fully complete!`);
        state.activeTasks.delete(taskId);
        return;
    }
    const workflow = getWorkflow(taskInfo.workflow || 'default');
    const currentIndex = workflow.pipeline.indexOf(taskInfo.agent);
    if (currentIndex === -1 || currentIndex === workflow.pipeline.length - 1) {
        // Task fully complete
        console.log(`[Orchestrator] Task ${taskId} fully complete!`);
        // Send completion notification
        await sendNotification(`✅ ${taskId} complete!`);
        state.activeTasks.delete(taskId);
        return;
    }
    const nextAgent = workflow.pipeline[currentIndex + 1];
    // Special case: QA complete → notify charmander for git decision
    if (taskInfo.agent === 'qa' && nextAgent === 'review-git') {
        await notifyCharmanderForGitOps(taskId, taskInfo);
        state.activeTasks.delete(taskId);
        return;
    }
    // Create handoff
    const handoff = createHandoff({
        from: taskInfo.agent,
        to: nextAgent,
        taskId,
        status: STATUS_COMPLETE,
        confidence: 0.8,
        summary: `Completed by ${taskInfo.agent}`
    });
    const handoffPath = saveHandoff(handoff, taskId, taskInfo.agent, nextAgent);
    // Enqueue for next agent
    const enqueueResult = enqueueTask(nextAgent, {
        id: taskId,
        handoffPath
    });
    if (enqueueResult.success) {
        console.log(`[Orchestrator] Queued ${taskId} for ${nextAgent}`);
        // Note: Agent will notify itself via agent-notify.ts on assignment
    }
    state.activeTasks.delete(taskId);
}
/**
 * Handles issues found by QA
 */
async function handleIssuesFound(taskId, taskInfo) {
    console.log(`[Orchestrator] Task ${taskId} has issues, routing back for revision`);
    const workflow = getWorkflow(taskInfo.workflow || 'default');
    const currentIndex = workflow.pipeline.indexOf(taskInfo.agent);
    if (currentIndex === -1 || currentIndex === 0) {
        // Can't route back - no previous agent
        console.error(`[Orchestrator] Task ${taskId} has issues but no previous agent to route to`);
        await sendNotification(`⚠️ ${taskId}: ${taskInfo.agent} found issues but no previous agent to route to. Manual intervention required.`);
        state.activeTasks.delete(taskId);
        return;
    }
    const previousAgent = workflow.pipeline[currentIndex - 1];
    // Create handoff back to previous agent
    const handoff = createHandoff({
        from: taskInfo.agent,
        to: previousAgent,
        taskId,
        status: STATUS_ISSUES_FOUND,
        confidence: 0,
        summary: `Revision required - ${taskInfo.agent} found issues`
    });
    const handoffPath = saveHandoff(handoff, taskId, taskInfo.agent, previousAgent);
    // Enqueue for previous agent
    const enqueueResult = enqueueTask(previousAgent, {
        id: taskId,
        handoffPath,
        workflow: taskInfo.workflow
    });
    if (enqueueResult.success) {
        console.log(`[Orchestrator] Routed ${taskId} back to ${previousAgent} for revision`);
        // Note: QA agent will notify itself via agent-notify.ts about issues found
    }
    state.activeTasks.delete(taskId);
}
/**
 * Handles task failure
 */
async function handleTaskFailed(taskId, taskInfo) {
    console.log(`[Orchestrator] Task ${taskId} failed`);
    const progress = readProgressFile(taskInfo.agent, taskId);
    const errorInfo = progress?.raw.match(/## Error\n\n(.+?)\n\n/)?.[1] || 'Unknown error';
    await sendNotification(`❌ ${taskId} failed\n\nAgent: ${taskInfo.agent}\nError: ${errorInfo}\n\nManual intervention required.`);
    state.activeTasks.delete(taskId);
}
/**
 * Notifies charmander for git operations after QA passes
 */
async function notifyCharmanderForGitOps(taskId, taskInfo) {
    console.log(`[Orchestrator] Notifying charmander for git ops on ${taskId}`);
    // Read progress file from the agent that just completed
    const progress = readProgressFile(taskInfo.agent, taskId);
    if (!progress) {
        console.error(`[Orchestrator] No progress file for ${taskId} (agent: ${taskInfo.agent})`);
        return;
    }
    // Parse fields from raw content
    const raw = progress.raw;
    // Extract summary from Summary section (multiline support)
    const summaryMatch = raw.match(/## Summary\n\n([\s\S]+?)(?=\n\n##|$)/);
    const summary = summaryMatch ? summaryMatch[1].trim() : 'Task completed';
    // Extract files changed from Files Changed section
    const filesChangedSection = raw.match(/## Files Changed\n\n([\s\S]+?)(?=\n\n##|$)/);
    const filesChanged = [];
    if (filesChangedSection) {
        const content = filesChangedSection[1].trim();
        // Skip if it says "None" or similar
        if (!content.toLowerCase().startsWith('none') && content !== '-') {
            const lines = content.split('\n');
            for (const line of lines) {
                // Try to match various markdown list formats
                // Format 1: - `filename`
                let match = line.match(/^-\s+`([^`]+)`/);
                if (match) {
                    filesChanged.push(match[1].trim());
                    continue;
                }
                // Format 2: - **filename**
                match = line.match(/^-\s+\*\*([^*]+)\*\*/);
                if (match) {
                    filesChanged.push(match[1].trim());
                    continue;
                }
                // Format 3: - filename* (with trailing asterisk)
                match = line.match(/^-\s+(\S+)\*/);
                if (match) {
                    filesChanged.push(match[1].trim());
                    continue;
                }
                // Format 4: - filename (plain)
                match = line.match(/^-\s+(.+)/);
                if (match) {
                    const filename = match[1].trim().replace(/^`+|`+$/g, '').replace(/^\*\*+|\*\*+$/g, '');
                    if (filename && !filename.toLowerCase().startsWith('none')) {
                        filesChanged.push(filename);
                    }
                }
            }
        }
    }
    // Extract test results from Verification section (flexible header matching)
    const verificationSection = raw.match(/## Verification[^\n]*\n\n([\s\S]+?)(?=\n\n##|$)/);
    const testResults = verificationSection ? verificationSection[1].trim() : 'No test results';
    // Format files list
    const filesList = filesChanged.map((f) => `  • ${f}`).join('\n');
    // Suggest conventional commit type based on task ID prefix
    let commitType = 'feat';
    if (taskId.toLowerCase().includes('fix') || taskId.toLowerCase().includes('bug')) {
        commitType = 'fix';
    }
    else if (taskId.toLowerCase().includes('doc')) {
        commitType = 'docs';
    }
    else if (taskId.toLowerCase().includes('refactor')) {
        commitType = 'refactor';
    }
    else if (taskId.toLowerCase().includes('test')) {
        commitType = 'test';
    }
    // Build suggested commit message
    const suggestedCommit = `${commitType}: ${summary.toLowerCase().replace(/[.!]$/, '')}`;
    // Create handoff document for charmander
    const handoff = createHandoff({
        from: taskInfo.agent,
        to: 'review-git',
        taskId,
        status: STATUS_COMPLETE,
        confidence: 1.0, // QA passed
        summary,
        filesChanged,
        learnings: [
            `QA Status: PASSED`,
            `Test Results: ${testResults}`,
            `Suggested Commit: ${suggestedCommit}`
        ],
        recommendations: [
            'Review the suggested commit message',
            'Confirm files to be staged',
            'Ask user for commit/push decision'
        ]
    });
    const handoffPath = saveHandoff(handoff, taskId, taskInfo.agent, 'review-git');
    console.log(`[Orchestrator] Created handoff: ${handoffPath}`);
    // Create progress file for git-decision task
    const gitDecisionTaskId = `${taskId}-git-decision`;
    createProgressFile('review-git', gitDecisionTaskId, {
        description: `Git decision for ${taskId}: ${summary}`
    });
    // Store task info for charmander to pick up
    state.activeTasks.set(gitDecisionTaskId, {
        agent: 'review-git',
        status: 'PENDING_DECISION',
        started: new Date().toISOString(),
        workflow: taskInfo.workflow
    });
    // Wake up charmander via tmux injection with git-decision context
    const sessionName = 'cc-review-git';
    const injectCmd = `/git-decision --task ${taskId} --handoff ${handoffPath}`;
    try {
        await injectTmuxCommand({ session: sessionName, window: 0, pane: 0 }, injectCmd);
        console.log(`[Orchestrator] Woke up ${sessionName} for git decision`);
    }
    catch (error) {
        console.error(`[Orchestrator] Failed to inject to ${sessionName}:`, error);
        // Continue to send notification anyway
    }
    // Build notification message
    const message = `📊 QA Results for ${taskId}

Status: ✅ PASSED

${testResults}

Files changed:
${filesList}

Summary:
${summary}

─────────────────────────────────────

Suggested commit:
\`${suggestedCommit}\`

Commit and push?`;
    // Send notification via charmander bot
    const charmanderBot = getBotByRole('review-git');
    const adminChat = charmanderBot?.permissions?.admin_users?.[0];
    if (!adminChat) {
        console.error('[Orchestrator] No admin chat configured for charmander');
        return;
    }
    try {
        const response = await fetch('http://localhost:3100/reply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                bot_id: 'charmander',
                chat_id: adminChat,
                text: message,
                parse_mode: 'Markdown'
            })
        });
        if (!response.ok) {
            console.error('[Orchestrator] Failed to send notification:', await response.text());
        }
        else {
            console.log('[Orchestrator] Sent git decision notification to user');
        }
    }
    catch (error) {
        console.error('[Orchestrator] Notification error:', error);
    }
}
/**
 * Processes agent queues
 */
async function processQueues() {
    for (const agent of getCoreAgents()) {
        const queueLength = getQueueLength(agent);
        if (queueLength > 0) {
            // Check if agent is busy
            const busyWithTask = [...state.activeTasks.values()].find(t => t.agent === agent);
            if (!busyWithTask) {
                const task = dequeueTask(agent);
                if (task) {
                    // Validate task has required id field
                    if (!task.id) {
                        console.error(`[Orchestrator] Task from ${agent} queue missing id field:`, JSON.stringify(task));
                        continue;
                    }
                    createProgressFile(agent, task.id, {
                        description: task.description || `Task ${task.id}`
                    });
                    state.activeTasks.set(task.id, {
                        agent,
                        status: 'IN_PROGRESS',
                        started: new Date().toISOString(),
                        workflow: task.workflow
                    });
                    if (task.handoffPath) {
                        sendToAgent(agent, `/plan-execute --auto --handoff ${task.handoffPath}`);
                    }
                    else if (task.planPath) {
                        sendToAgent(agent, `/plan-execute --auto --plan ${task.planPath}`);
                    }
                    console.log(`[Orchestrator] Assigned ${task.id} to ${agent}`);
                }
            }
        }
    }
}
/**
 * Submits a new task to the orchestrator
 */
export async function submitTask(task) {
    const workflow = getWorkflow(task.workflow || 'default');
    const firstAgent = workflow.pipeline[0];
    console.log(`[Orchestrator] Submitting task ${task.id} to ${firstAgent}`);
    const result = enqueueTask(firstAgent, {
        id: task.id,
        description: task.description,
        workflow: task.workflow || 'default',
        planPath: task.planPath,
        chatId: task.chatId
    });
    return result;
}
/**
 * Stops the orchestrator
 */
export async function stop() {
    console.log('[Orchestrator] Stopping...');
    state.isRunning = false;
}
/**
 * Gets orchestrator status
 */
export function getStatus() {
    return {
        ...state,
        activeTasks: state.activeTasks,
        queueLengths: Object.fromEntries(getCoreAgents().map(a => [a, getQueueLength(a)])),
        runningAgents: listAgentSessions()
    };
}
/**
 * Helper: sleep
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
export { getCoreAgents };
//# sourceMappingURL=orchestrator.js.map