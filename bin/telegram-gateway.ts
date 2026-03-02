#!/usr/bin/env npx tsx
/**
 * Telegram Gateway Start Script
 *
 * Starts the Express gateway for Telegram webhook handling.
 * Routes messages to tmux sessions via Redis streams.
 *
 * Usage:
 *   npx tsx bin/telegram-gateway.ts
 *   npx tsx bin/telegram-gateway.ts --config config/gateway.yaml
 *
 * Environment variables:
 *   CC_CONFIG_PATH  - Override config path (default: modules/bots/config/bots.local.yaml)
 *   REDIS_URL       - Redis connection URL (default: redis://localhost:6379)
 *   PORT            - Gateway port (default: from config, typically 3100)
 *   HOST            - Gateway host (default: from config, typically 0.0.0.0)
 */

import { spawn } from 'child_process';
import { resolve } from 'path';
import { existsSync } from 'fs';

// Parse command line arguments
const args = process.argv.slice(2);
let configPath = process.env.CC_CONFIG_PATH || '';

// Parse --config flag
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--config' && args[i + 1]) {
    configPath = args[i + 1];
    i++;
  }
}

// Default config path if not specified
if (!configPath) {
  configPath = 'modules/bots/config/bots.local.yaml';
}

// Resolve to absolute path
const absoluteConfigPath = resolve(process.cwd(), configPath);

// Verify config exists
if (!existsSync(absoluteConfigPath)) {
  console.error(`Config file not found: ${absoluteConfigPath}`);
  console.error('\nAvailable configs:');
  console.error('  modules/bots/config/bots.local.yaml  - Local development');
  console.error('  modules/bots/config/bots.example.yaml - Example template');
  console.error('\nCreate a config file or specify with --config <path>');
  process.exit(1);
}

console.log(`Starting Telegram Gateway...`);
console.log(`Config: ${absoluteConfigPath}`);

// Path to gateway entry point
const gatewayPath = resolve(process.cwd(), 'modules/bots/packages/gateway/dist/index.js');

// Verify gateway is built
if (!existsSync(gatewayPath)) {
  console.error(`Gateway not built: ${gatewayPath}`);
  console.error('\nBuild the gateway first:');
  console.error('  cd modules/bots/packages/gateway && npm run build');
  process.exit(1);
}

// Set environment variables
const env = {
  ...process.env,
  CC_CONFIG_PATH: absoluteConfigPath,
};

// Start the gateway
const gateway = spawn('node', [gatewayPath], {
  env,
  stdio: 'inherit',
  cwd: resolve(process.cwd(), 'modules/bots/packages/gateway'),
});

// Handle gateway exit
gateway.on('exit', (code, signal) => {
  if (signal) {
    console.log(`Gateway killed by signal: ${signal}`);
    process.exit(1);
  } else if (code !== 0 && code !== null) {
    console.error(`Gateway exited with code: ${code}`);
    process.exit(code);
  }
});

// Forward signals to gateway
process.on('SIGINT', () => {
  gateway.kill('SIGINT');
});

process.on('SIGTERM', () => {
  gateway.kill('SIGTERM');
});
