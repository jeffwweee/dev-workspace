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
export {};
//# sourceMappingURL=telegram-gateway.d.ts.map