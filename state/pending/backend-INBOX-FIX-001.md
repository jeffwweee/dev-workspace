# INBOX-FIX-001: Bot-Specific Inbox Streams

## Priority
Critical

## Context
From pichu orchestrator session (chat 195061634)

## Problem
The current inbox implementation uses a shared stream (`tg:inbox`) for all bots. When a bot polls for messages, it can claim ANY message from the stream, not just messages meant for that bot. This causes messages to be delivered to the wrong bot.

**Example:**
- Charmander polls and gets a message meant for pichu
- Pichu polls and gets a message meant for charmander

**Root cause:** Redis streams don't support field-level filtering in XREADGROUP.

## Solution
Implement bot-specific streams: `tg:inbox:{bot_id}`

### Changes Required

#### 1. Create Local Development Config
Create `config/gateway.local.yaml`:
```yaml
server:
  port: 3001
  host: localhost

redis:
  url: "redis://localhost:6379"

bots:
  - name: pichu
    role: orchestrator
  - name: pikachu
    role: backend
  - name: raichu
    role: frontend
  - name: bulbasaur
    role: qa
  - name: charmander
    role: review-git
```

#### 2. Update Inbox Service (`modules/bots/packages/gateway/src/services/inbox.ts`)
- Modify `writeToInbox` to write to `tg:inbox:{bot_id}` instead of `tg:inbox`
- Add `getInboxStreamKey(botId: string)` helper function

```typescript
export function getInboxStreamKey(botId: string): string {
  return `${REDIS_KEYS.INBOX_STREAM}:${botId}`;
}

export async function writeToInbox(
  redis: Redis,
  message: InboxMessage
): Promise<string> {
  const { id, ...messageData } = message;
  const streamKey = getInboxStreamKey(message.bot_id);

  const streamId = await redis.xadd(
    streamKey,
    '*',
    ...Object.entries(messageData).flat()
  ) as string | null;

  // ... rest of function
}
```

#### 3. Update Webhook Handler (`modules/bots/packages/gateway/src/routes/webhook.ts`)
- Modify `handlePoll` to read from bot-specific stream

```typescript
export async function handlePoll(req: Request, res: Response): Promise<void> {
  const botId = req.query.bot_id as string;
  const streamKey = getInboxStreamKey(botId);

  // Ensure consumer group exists for this bot's stream
  await ensureConsumerGroupForBot(redis, botId);

  // Read from bot-specific stream
  const results = await redis.call(
    'XREADGROUP',
    'GROUP',
    `${REDIS_KEYS.CONSUMER_GROUP}:${botId}`,
    consumerName,
    'COUNT', '1',
    'BLOCK', blockMs,
    'STREAMS',
    streamKey,  // Bot-specific stream
    '>'
  ) as any;
  // ... rest of function
}
```

#### 4. Update Consumer Group Management
- Add `ensureConsumerGroupForBot(redis, botId)` function
- Create consumer group per bot stream

```typescript
export async function ensureConsumerGroupForBot(redis: Redis, botId: string): Promise<void> {
  const streamKey = getInboxStreamKey(botId);
  const groupName = `${REDIS_KEYS.CONSUMER_GROUP}:${botId}`;

  try {
    await redis.call(
      'XGROUP', 'CREATE',
      streamKey,
      groupName,
      '0',
      'MKSTREAM'
    );
  } catch (error: unknown) {
    if (error instanceof Error && !error.message.includes('BUSYGROUP')) {
      throw error;
    }
  }
}
```

#### 5. Update Ack Handler
- Modify `handleAck` to use bot-specific stream

#### 6. Update Constants (`modules/bots/packages/shared/src/constants.ts`)
Add helper for dynamic stream keys (optional, can be inline)

## Files to Modify
- `config/gateway.local.yaml` (NEW)
- `modules/bots/packages/gateway/src/services/inbox.ts`
- `modules/bots/packages/gateway/src/routes/webhook.ts`
- `modules/bots/packages/gateway/src/config/loader.ts` (if needed for local config)

## Testing
1. Start gateway with local config: `tsx bin/telegram-gateway.ts --config config/gateway.local.yaml`
2. Send message to pichu bot
3. Poll as pichu - should get pichu's message
4. Poll as charmander - should get null (no messages for charmander)
5. Send message to charmander bot
6. Poll as charmander - should get charmander's message

## Verification
- Messages are only delivered to the correct bot
- No cross-bot message pollution
- All existing functionality preserved

## Notes
- This is a breaking change to the inbox stream structure
- Existing messages in shared stream will need migration or can be ignored (they'll expire)
- Port 3001 for local testing to avoid conflicts with production gateway on 3100
