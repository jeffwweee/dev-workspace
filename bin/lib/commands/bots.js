/**
 * Bots Command Module
 *
 * CLI commands for tg-bots gateway management:
 * - start: Start the gateway with PM2
 * - stop: Stop the gateway
 * - restart: Restart the gateway
 * - status: Show gateway status
 * - logs: View gateway logs
 * - config: Validate/show bot configuration
 */
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, '../../..');
const BOTS_MODULE = path.join(WORKSPACE_ROOT, 'modules/bots');
const GATEWAY_PATH = path.join(BOTS_MODULE, 'packages/gateway');
const CONFIG_PATH = path.join(WORKSPACE_ROOT, 'config/bots.yaml');
/**
 * Check if bots module exists
 */
function checkBotsModule() {
    return fs.existsSync(BOTS_MODULE) && fs.existsSync(GATEWAY_PATH);
}
/**
 * Check if config exists
 */
function checkConfig() {
    const configExists = fs.existsSync(CONFIG_PATH);
    return { exists: configExists, path: CONFIG_PATH };
}
/**
 * Start the gateway
 */
export async function botsStart(options = {}) {
    if (!checkBotsModule()) {
        return {
            success: false,
            error: 'DW_BOTS_NOT_FOUND',
            message: 'tg-bots module not found. Run: git submodule update --init modules/bots'
        };
    }
    const config = checkConfig();
    if (!config.exists) {
        return {
            success: false,
            error: 'DW_BOTS_CONFIG_NOT_FOUND',
            message: `Config not found at ${config.path}. Copy from modules/bots/config/bots.example.yaml`
        };
    }
    try {
        // Check if PM2 ecosystem config exists
        const pm2ConfigPath = path.join(BOTS_MODULE, 'config/pm2.ecosystem.config.js');
        const pm2ConfigExists = fs.existsSync(pm2ConfigPath);
        if (pm2ConfigExists) {
            execSync(`npx pm2 start ${pm2ConfigPath}`, {
                cwd: BOTS_MODULE,
                stdio: 'inherit'
            });
        }
        else {
            // Start directly with tsx
            const entryPoint = path.join(GATEWAY_PATH, 'src/index.ts');
            execSync(`npx pm2 start npx --name tg-gateway -- tsx ${entryPoint}`, {
                cwd: BOTS_MODULE,
                stdio: 'inherit',
                env: {
                    ...process.env,
                    CC_CONFIG_PATH: CONFIG_PATH
                }
            });
        }
        return {
            success: true,
            message: 'Gateway started with PM2',
            hint: 'Use "dw bots logs" to view logs, "dw bots status" to check status'
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            success: false,
            error: 'DW_BOTS_START_FAILED',
            message
        };
    }
}
/**
 * Stop the gateway
 */
export async function botsStop(options = {}) {
    try {
        execSync('npx pm2 stop tg-gateway', { stdio: 'pipe' });
        return {
            success: true,
            message: 'Gateway stopped'
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            success: false,
            error: 'DW_BOTS_STOP_FAILED',
            message
        };
    }
}
/**
 * Restart the gateway
 */
export async function botsRestart(options = {}) {
    try {
        execSync('npx pm2 restart tg-gateway', { stdio: 'pipe' });
        return {
            success: true,
            message: 'Gateway restarted'
        };
    }
    catch (error) {
        // If restart fails, try starting
        return botsStart(options);
    }
}
/**
 * Show gateway status
 */
export async function botsStatus(options = {}) {
    if (options.json) {
        try {
            const output = execSync('npx pm2 jlist', { encoding: 'utf-8' });
            const processes = JSON.parse(output);
            const gateway = processes.find((p) => p.name === 'tg-gateway');
            return {
                success: true,
                running: !!gateway,
                process: gateway || null
            };
        }
        catch {
            return {
                success: true,
                running: false,
                process: null
            };
        }
    }
    try {
        execSync('npx pm2 status', { stdio: 'inherit' });
        return { success: true };
    }
    catch {
        return {
            success: false,
            error: 'DW_PM2_NOT_RUNNING',
            message: 'PM2 not running or gateway not started'
        };
    }
}
/**
 * View gateway logs
 */
export async function botsLogs(options = {}) {
    const lines = options.lines || 100;
    const follow = options.follow;
    try {
        const cmd = follow
            ? `npx pm2 logs tg-gateway --lines ${lines}`
            : `npx pm2 logs tg-gateway --lines ${lines} --nostream`;
        execSync(cmd, { stdio: 'inherit' });
        return { success: true };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            success: false,
            error: 'DW_BOTS_LOGS_FAILED',
            message
        };
    }
}
/**
 * Validate/show configuration
 */
export async function botsConfig(options = {}) {
    const config = checkConfig();
    if (!config.exists) {
        return {
            success: false,
            error: 'DW_BOTS_CONFIG_NOT_FOUND',
            message: `Config not found at ${config.path}`,
            examplePath: path.join(BOTS_MODULE, 'config/bots.example.yaml')
        };
    }
    if (options.json) {
        // Dynamic import for yaml parsing
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const yaml = require('js-yaml');
        const content = fs.readFileSync(config.path, 'utf-8');
        const parsed = yaml.load(content);
        const safeParsed = parsed;
        if (safeParsed.bots) {
            safeParsed.bots = safeParsed.bots.map((bot) => ({
                ...bot,
                token: bot.token ? '[REDACTED]' : undefined
            }));
        }
        return {
            success: true,
            config: safeParsed,
            path: config.path
        };
    }
    // Show config path and validation status
    return {
        success: true,
        message: `Config found at: ${config.path}`,
        hint: 'Use --json to see parsed config (tokens redacted)'
    };
}
/**
 * Main bots command router
 */
export async function botsCommand(subcommand = 'status', args = [], options = {}) {
    switch (subcommand) {
        case 'start':
            return botsStart(options);
        case 'stop':
            return botsStop(options);
        case 'restart':
            return botsRestart(options);
        case 'status':
            return botsStatus(options);
        case 'logs':
            options.follow = options.follow ?? true;
            return botsLogs(options);
        case 'config':
            return botsConfig(options);
        default:
            return {
                success: false,
                error: 'DW_UNKNOWN_SUBCOMMAND',
                message: `Unknown subcommand: ${subcommand}. Use: start, stop, restart, status, logs, config`
            };
    }
}
//# sourceMappingURL=bots.js.map