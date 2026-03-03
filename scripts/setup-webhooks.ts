#!/usr/bin/env npx tsx
/**
 * Setup Telegram Bot Webhooks
 *
 * Configures webhooks for all bots to point to rx78.jeffwweee.cc
 *
 * Usage: npx tsx scripts/setup-webhooks.ts
 */

import { execSync } from 'child_process';

const DOMAIN = 'https://rx78.jeffwweee.cc';

const bots = [
  { name: 'pichu', env: 'PICHU_BOT_TOKEN', path: '/webhook/pichu' },
  { name: 'pikachu', env: 'PIKACHU_BOT_TOKEN', path: '/webhook/pikachu' },
  { name: 'raichu', env: 'RAICHU_BOT_TOKEN', path: '/webhook/raichu' },
  { name: 'bulbasaur', env: 'BULBASAUR_BOT_TOKEN', path: '/webhook/bulbasaur' },
  { name: 'charmander', env: 'CHARMANDER_BOT_TOKEN', path: '/webhook/charmander' },
];

async function setWebhook(botName: string, token: string, path: string): Promise<boolean> {
  const url = `${DOMAIN}${path}`;
  const apiUrl = `https://api.telegram.org/bot${token}/setWebhook`;

  console.log(`\n🤖 ${botName} -> ${url}`);

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        drop_pending_updates: true,
      }),
    });

    const result = await response.json();

    if (result.ok) {
      console.log(`   ✅ Webhook set successfully`);
      console.log(`   📡 ${result.result}`);
      return true;
    } else {
      console.log(`   ❌ Failed: ${result.description}`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error}`);
    return false;
  }
}

async function getWebhookInfo(botName: string, token: string): Promise<void> {
  const apiUrl = `https://api.telegram.org/bot${token}/getWebhookInfo`;

  try {
    const response = await fetch(apiUrl);
    const result = await response.json();

    if (result.ok) {
      const info = result.result;
      console.log(`   📋 Current webhook: ${info.url || '(not set)'}`);
      if (info.url && !info.url.includes(DOMAIN)) {
        console.log(`   ⚠️  Webhook points to different domain`);
      }
    }
  } catch {
    // Ignore errors for webhook info
  }
}

async function main() {
  console.log('='.repeat(50));
  console.log('Telegram Bot Webhook Setup');
  console.log(`Domain: ${DOMAIN}`);
  console.log('='.repeat(50));

  let successCount = 0;
  let failCount = 0;

  for (const bot of bots) {
    const token = process.env[bot.env];

    if (!token) {
      console.log(`\n⚠️  ${bot.name}: Token not found (${bot.env})`);
      failCount++;
      continue;
    }

    // Show current webhook info first
    await getWebhookInfo(bot.name, token);

    // Set new webhook
    const success = await setWebhook(bot.name, token, bot.path);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`Summary: ${successCount} succeeded, ${failCount} failed`);
  console.log('='.repeat(50));
}

main().catch(console.error);
