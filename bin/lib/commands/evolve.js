/**
 * Evolve CLI command - Interface to the evolution system
 *
 * Provides subcommands for:
 * - status: Show registry info and top genes
 * - solidify: Force solidify session signals
 * - export: Backup to file system
 * - publish: Mark gene as publishable
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
// Load CommonJS modules from evolution scripts (using any for dynamic imports)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let signals = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let solidify = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let promote = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let exportModule = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let redis = null;
try {
    signals = require('../../../.claude/skills/capability-evolver/scripts/signals.cjs');
    solidify = require('../../../.claude/skills/capability-evolver/scripts/solidify.cjs');
    promote = require('../../../.claude/skills/capability-evolver/scripts/promote.cjs');
    exportModule = require('../../../.claude/skills/capability-evolver/scripts/export.cjs');
    redis = require('../../../.claude/skills/capability-evolver/scripts/redis.cjs');
}
catch {
    // Modules will be null if loading fails
}
/**
 * Check if Redis is available and modules loaded
 */
function checkModules() {
    if (!signals || !solidify || !promote || !exportModule || !redis) {
        return {
            available: false,
            error: 'Evolution modules not loaded. Check that scripts exist in .claude/skills/capability-evolver/scripts/'
        };
    }
    return { available: true };
}
/**
 * Handle Redis connection errors gracefully
 */
async function withRedisConnection(operation, fallback) {
    try {
        return await operation();
    }
    catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (errorMessage.includes('ECONNREFUSED') ||
            errorMessage.includes('ENOTFOUND') ||
            errorMessage.includes('ECONNRESET') ||
            errorMessage.includes('Redis connection')) {
            console.error(`Redis connection error: ${errorMessage}`);
            return {
                ...fallback,
                success: false,
                error: `Cannot connect to Redis: ${errorMessage}`
            };
        }
        throw err;
    }
    finally {
        // Clean up connection
        if (redis) {
            try {
                await redis.close();
            }
            catch {
                // Ignore close errors
            }
        }
    }
}
/**
 * Show evolution system status
 */
export async function evolveStatus(options = {}) {
    const moduleCheck = checkModules();
    if (!moduleCheck.available) {
        return {
            success: false,
            connected: false,
            error: moduleCheck.error
        };
    }
    const limit = options.limit || 10;
    return withRedisConnection(async () => {
        const topGenes = await promote.getTopGenes(limit);
        const recentEvents = await signals.getRecentEvents(20);
        return {
            success: true,
            connected: true,
            registry: {
                totalGenes: topGenes.length,
                topGenes: topGenes.map((g) => ({
                    id: g.id,
                    name: g.name || 'Unnamed',
                    type: g.type || 'pattern',
                    gdiScore: parseFloat(g.metadata?.gdiScore || '0'),
                    usageCount: parseInt(g.metadata?.usageCount || '0', 10),
                    successRate: parseFloat(g.metadata?.successRate || '0')
                }))
            },
            recentEvents: recentEvents.map((e) => ({
                ts: e.ts,
                type: e.type,
                category: e.category,
                session: e.session,
                data: e.data
            }))
        };
    }, {
        success: false,
        connected: false,
        error: 'Redis connection failed'
    });
}
/**
 * Force solidify session signals to gene candidates
 */
export async function evolveSolidify(sessionId) {
    const moduleCheck = checkModules();
    if (!moduleCheck.available) {
        return {
            success: false,
            error: moduleCheck.error,
            sessionId,
            signalsAnalyzed: 0,
            candidates: 0,
            message: moduleCheck.error || 'Unknown error'
        };
    }
    if (!sessionId) {
        return {
            success: false,
            error: 'Session ID is required',
            sessionId: '',
            signalsAnalyzed: 0,
            candidates: 0,
            message: 'Session ID is required'
        };
    }
    return withRedisConnection(async () => {
        const result = await solidify.solidify(sessionId);
        return {
            success: result.success,
            sessionId,
            signalsAnalyzed: result.signalsAnalyzed,
            candidates: result.candidates?.length || 0,
            message: result.message || 'Solidification complete'
        };
    }, {
        success: false,
        error: 'Redis connection failed',
        sessionId,
        signalsAnalyzed: 0,
        candidates: 0,
        message: 'Redis connection failed'
    });
}
/**
 * Export genes to file system backup
 */
export async function evolveExport() {
    const moduleCheck = checkModules();
    if (!moduleCheck.available) {
        return {
            success: false,
            error: moduleCheck.error
        };
    }
    return withRedisConnection(async () => {
        const result = await exportModule.exportAll();
        return {
            success: result.success,
            genes: {
                exported: result.genes?.exported || 0,
                genes: result.genes?.genes || []
            },
            snapshot: result.snapshot
                ? {
                    path: result.snapshot.path,
                    genesExported: result.snapshot.genesExported,
                    eventsExported: result.snapshot.eventsExported
                }
                : undefined
        };
    }, {
        success: false,
        error: 'Redis connection failed'
    });
}
/**
 * Mark a gene as publishable
 */
export async function evolvePublish(geneId) {
    const moduleCheck = checkModules();
    if (!moduleCheck.available) {
        return {
            success: false,
            error: moduleCheck.error,
            geneId: geneId || '',
            publishable: false,
            message: moduleCheck.error || 'Unknown error'
        };
    }
    if (!geneId) {
        return {
            success: false,
            error: 'Gene ID is required',
            geneId: '',
            publishable: false,
            message: 'Gene ID is required'
        };
    }
    return withRedisConnection(async () => {
        const client = await redis.getClient();
        // Check if gene exists
        const exists = await client.exists(redis.keys.gene(geneId));
        if (!exists) {
            return {
                success: false,
                error: `Gene ${geneId} not found`,
                geneId,
                publishable: false,
                message: `Gene ${geneId} not found in registry`
            };
        }
        // Mark as publishable
        await client.hset(redis.keys.gene(geneId), { publishable: 'true' });
        await client.sadd(redis.keys.publishable(), geneId);
        return {
            success: true,
            geneId,
            publishable: true,
            message: `Gene ${geneId} marked as publishable`
        };
    }, {
        success: false,
        error: 'Redis connection failed',
        geneId,
        publishable: false,
        message: 'Redis connection failed'
    });
}
//# sourceMappingURL=evolve.js.map