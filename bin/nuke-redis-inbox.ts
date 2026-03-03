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

import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

async function nukeInbox() {
  try {
    console.log('🔍 Scanning Redis for Telegram keys...\n');

    // Delete inbox stream
    const inboxResult = await redis.del('tg:inbox');
    if (inboxResult > 0) {
      console.log(`✅ Deleted tg:inbox (${inboxResult} key)`);
    }

    // Delete all processed updates keys
    const keys = await redis.keys('tg:processed_updates:*');
    if (keys.length > 0) {
      const result = await redis.del(...keys);
      console.log(`✅ Deleted ${result} tg:processed_updates:* keys`);
    }

    // Clear context keys
    const contextKeys = await redis.keys('tg:inbox:context:*');
    if (contextKeys.length > 0) {
      const result = await redis.del(...contextKeys);
      console.log(`✅ Deleted ${result} tg:inbox:context:* keys`);
    }

    // Summary
    const remainingKeys = await redis.keys('tg:*');
    console.log(`\n🧹 Redis inbox nuked!`);
    console.log(`📊 Remaining tg:* keys: ${remainingKeys.length}`);

    if (remainingKeys.length > 0) {
      console.log('\nRemaining keys:');
      for (const key of remainingKeys.slice(0, 10)) {
        const type = await redis.type(key);
        console.log(`  - ${key} (${type})`);
      }
      if (remainingKeys.length > 10) {
        console.log(`  ... and ${remainingKeys.length - 10} more`);
      }
    }
  } catch (error) {
    console.error('❌ Error:', (error as Error).message);
    process.exit(1);
  } finally {
    await redis.quit();
  }
}

nukeInbox();
