#!/usr/bin/env node
/**
 * Nuke Redis Inbox
 *
 * Clears all Telegram-related keys from Redis:
 * - tg:inbox (stream)
 * - tg:processed_updates:* (processed message tracking)
 * - tg:inbox:context:* (message context storage)
 *
 * Usage: node bin/nuke-redis-inbox.ts
 */
export {};
//# sourceMappingURL=nuke-redis-inbox.d.ts.map