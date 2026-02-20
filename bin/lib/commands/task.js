import { getStatePath, getRegistryPath, atomicWrite, readJson, auditLog } from '../state/manager.js';
export async function pickNext(options) {
    const queuePath = getStatePath('queue.json');
    const activePath = getStatePath('active.json');
    const projectsPath = getRegistryPath('projects.json');
    const session = readJson(activePath, {
        sessionId: null,
        activeProject: null,
        startTime: null,
        status: 'inactive'
    });
    if (!session.sessionId) {
        return {
            success: false,
            error: 'DW_NO_SESSION',
            message: 'No active session. Run "dw init" first.'
        };
    }
    const queueData = readJson(queuePath, { queue: [] });
    const projectsData = readJson(projectsPath, { projects: [] });
    // Filter queue by project if specified
    let availableTasks = queueData.queue;
    if (options.project) {
        const project = projectsData.projects.find(p => p.id === options.project || p.name === options.project);
        if (!project) {
            return {
                success: false,
                error: 'DW_NO_PROJECT',
                message: `Project '${options.project}' not found`
            };
        }
        availableTasks = availableTasks.filter(t => t.projectId === project.id);
    }
    // Filter pending tasks and sort by priority (higher first)
    const pendingTasks = availableTasks
        .filter(t => t.status === 'pending')
        .sort((a, b) => b.priority - a.priority);
    if (pendingTasks.length === 0) {
        return {
            success: true,
            task: null,
            message: 'No pending tasks available'
        };
    }
    const nextTask = pendingTasks[0];
    // Mark as in_progress
    nextTask.status = 'in_progress';
    atomicWrite(queuePath, queueData);
    auditLog({
        timestamp: new Date().toISOString(),
        event: 'task_picked',
        sessionId: session.sessionId,
        data: {
            taskId: nextTask.taskId,
            projectId: nextTask.projectId
        }
    });
    return {
        success: true,
        task: {
            id: nextTask.taskId,
            projectId: nextTask.projectId,
            title: nextTask.title,
            priority: nextTask.priority
        },
        message: `Selected task: ${nextTask.title}`
    };
}
export async function recordResult(options) {
    const queuePath = getStatePath('queue.json');
    const activePath = getStatePath('active.json');
    const session = readJson(activePath, {
        sessionId: null,
        activeProject: null,
        startTime: null,
        status: 'inactive'
    });
    if (!session.sessionId) {
        return {
            success: false,
            error: 'DW_NO_SESSION',
            message: 'No active session. Run "dw init" first.'
        };
    }
    // Validate status
    const validStatuses = ['passed', 'failed', 'partial', 'blocked'];
    if (!validStatuses.includes(options.status.toLowerCase())) {
        return {
            success: false,
            error: 'DW_INVALID_STATUS',
            message: `Status must be one of: ${validStatuses.join(', ')}`
        };
    }
    const queueData = readJson(queuePath, { queue: [] });
    // Find the task
    const task = queueData.queue.find(t => t.taskId === options.task);
    if (!task) {
        return {
            success: false,
            error: 'DW_INVALID_TASK',
            message: `Task '${options.task}' not found in queue`
        };
    }
    // Update task status
    task.status = options.status.toLowerCase();
    atomicWrite(queuePath, queueData);
    // Parse files
    const changedFiles = options.files
        ? options.files.split(',').map(f => f.trim())
        : [];
    auditLog({
        timestamp: new Date().toISOString(),
        event: 'task_completed',
        sessionId: session.sessionId,
        data: {
            taskId: options.task,
            status: options.status,
            files: changedFiles,
            summary: options.summary || ''
        }
    });
    return {
        success: true,
        task: {
            id: task.taskId,
            status: task.status,
            title: task.title
        },
        files: changedFiles,
        message: `Task marked as ${options.status}`
    };
}
export async function showQueue() {
    const queuePath = getStatePath('queue.json');
    const queueData = readJson(queuePath, { queue: [] });
    const byStatus = {
        pending: queueData.queue.filter(t => t.status === 'pending'),
        in_progress: queueData.queue.filter(t => t.status === 'in_progress'),
        completed: queueData.queue.filter(t => t.status === 'completed'),
        failed: queueData.queue.filter(t => t.status === 'failed')
    };
    return {
        success: true,
        summary: {
            total: queueData.queue.length,
            pending: byStatus.pending.length,
            in_progress: byStatus.in_progress.length,
            completed: byStatus.completed.length,
            failed: byStatus.failed.length
        },
        pending: byStatus.pending
            .sort((a, b) => b.priority - a.priority)
            .map(t => ({
            id: t.taskId,
            projectId: t.projectId,
            title: t.title,
            priority: t.priority
        })),
        inProgress: byStatus.in_progress.map(t => ({
            id: t.taskId,
            projectId: t.projectId,
            title: t.title,
            priority: t.priority
        }))
    };
}
//# sourceMappingURL=task.js.map