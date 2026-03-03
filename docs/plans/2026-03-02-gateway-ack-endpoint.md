# Implementation Plan: Gateway /ack Endpoint

**Created:** 2026-03-02
**Task:** Add /ack endpoint to gateway for eager message acknowledgment
**Status:** Planning

## Background

### Current Flow
```
Webhook → Redis Stream → Poll (claims message) → Reply (acks message)
```

### Problem
Messages are only acknowledged when `/reply` is called with `inbox_id`. If the agent crashes between poll and reply, the Redis Stream message remains "pending" and can be re-processed by another consumer.

### Solution
Add a dedicated `POST /ack` endpoint for immediate acknowledgment after polling.

## Design

### API Endpoint

**Request:**
```http
POST /ack
Content-Type: application/json

{
  "inbox_id": "1234567890-0"
}
```

**Response:**
```json
// Success
{
  "ok": true,
  "inbox_id": "1234567890-0"
}

// Error
{
  "error": "Missing inbox_id"
}
```

### Implementation Location

**File:** `modules/bots/packages/gateway/src/routes/webhook.ts`

Add after `handleReply` function:

```typescript
/**
 * POST /ack
 * Acknowledge a polled inbox message without sending a reply
 * Use for eager ack to prevent message re-processing
 */
export async function handleAck(req: Request, res: Response): Promise<void> {
  try {
    const { inbox_id } = req.body;

    if (!inbox_id) {
      res.status(400).json({ error: 'Missing inbox_id' });
      return;
    }

    const redis = getRedisClient(process.env.REDIS_URL || 'redis://localhost:6379');
    await ackInboxMessage(redis, inbox_id);

    res.status(200).json({ ok: true, inbox_id });
  } catch (error) {
    const logger = createLogger('ack');
    logger.error({ error }, 'Error handling ack');
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

Register the route:

```typescript
export function registerWebhookRoutes(router: Router): void {
  router.post('/webhook/:botId', handleWebhook);
  router.post('/reply', handleReply);
  router.post('/ack', handleAck);  // NEW
  router.get('/poll', handlePoll);
}
```

## Test Cases

**File:** `modules/bots/packages/gateway/test/ack.test.ts` (new)

```typescript
describe('POST /ack', () => {
  it('should acknowledge an inbox message', async () => {
    // 1. Write to inbox
    // 2. Poll to claim
    // 3. Call /ack
    // 4. Verify XACK was called
  });

  it('should return 400 if inbox_id missing', async () => {
    // Test validation
  });

  it('should return 500 for invalid inbox_id', async () => {
    // Test error handling
  });
});
```

## Optional: /telegram-ack Skill

**File:** `.claude/commands/telegram-ack.md` (new)

```markdown
Acknowledge the last polled Telegram message without sending a reply.

Use this to immediately mark a message as processed (prevents re-processing).

Usage:
- `/telegram-ack` — Acknowledge last polled message

Steps:
1. Get message context from last poll (inbox_id)
2. Call gateway /ack endpoint
3. Report result
```

## Implementation Steps

1. [ ] Add `handleAck` function to `webhook.ts`
2. [ ] Register route in `registerWebhookRoutes`
3. [ ] Add unit tests in `ack.test.ts`
4. [ ] Test manually via curl
5. [ ] (Optional) Add `/telegram-ack` skill wrapper

## Verification

```bash
# Manual test
curl -X POST 'http://localhost:3100/ack' \
  -H 'Content-Type: application/json' \
  -d '{"inbox_id": "test-id"}'

# Run tests
cd modules/bots/packages/gateway
npm test
```
