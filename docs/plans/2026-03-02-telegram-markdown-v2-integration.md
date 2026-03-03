# Telegram MarkdownV2 Integration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `plan-execute` or `plan-parallel` skill to implement this plan task-by-task.

**Goal:** Integrate `telegram-markdown-v2` library into the gateway for automatic Markdown-to-MarkdownV2 conversion, eliminating manual escaping.

**Architecture:** Add a markdown conversion layer in the gateway's `/reply` endpoint. When `parse_mode` is `MarkdownV2`, automatically convert standard Markdown to Telegram's format using the library. Add `skip_conversion` flag for pre-formatted text.

**Tech Stack:** TypeScript, Express, `telegram-markdown-v2` npm library, Node.js test runner

---

## Task 1: Install telegram-markdown-v2 Library

**Files:**
- Modify: `modules/bots/packages/gateway/package.json`

**Step 1: Install the dependency**

```bash
cd /home/jeffwweee/jef/dev-workspace/modules/bots
npm install telegram-markdown-v2 --workspace=@tg-bots/gateway
```

**Step 2: Verify installation**

Run: `cat /home/jeffwweee/jef/dev-workspace/modules/bots/packages/gateway/package.json | grep telegram-markdown`
Expected: `"telegram-markdown-v2": "^x.y.z"`

**Step 3: Commit**

```bash
git add modules/bots/packages/gateway/package.json modules/bots/package-lock.json
git commit -m "feat(gateway): add telegram-markdown-v2 dependency"
```

---

## Task 2: Create Markdown Conversion Utility

**Files:**
- Create: `modules/bots/packages/gateway/src/services/markdown.ts`
- Create: `modules/bots/packages/gateway/test/markdown.test.ts`

**Step 1: Write the failing test**

```typescript
// test/markdown.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { convertToMarkdownV2 } from '../dist/services/markdown.js';

describe('Markdown Conversion', () => {
  it('should convert bold text', () => {
    const input = 'This is **bold** text';
    const result = convertToMarkdownV2(input);
    assert.ok(result.includes('*bold*'));
  });

  it('should convert italic text', () => {
    const input = 'This is *italic* text';
    const result = convertToMarkdownV2(input);
    assert.ok(result.includes('_italic_'));
  });

  it('should convert code blocks', () => {
    const input = '```\ncode here\n```';
    const result = convertToMarkdownV2(input);
    assert.ok(result.includes('```'));
  });

  it('should convert inline code', () => {
    const input = 'Use the `convert` function';
    const result = convertToMarkdownV2(input);
    assert.ok(result.includes('`convert`'));
  });

  it('should convert links', () => {
    const input = '[click here](https://example.com)';
    const result = convertToMarkdownV2(input);
    assert.ok(result.includes('[click here]'));
    assert.ok(result.includes('(https://example.com)'));
  });

  it('should convert lists', () => {
    const input = '- Item 1\n- Item 2';
    const result = convertToMarkdownV2(input);
    assert.ok(result.includes('• Item 1'));
    assert.ok(result.includes('• Item 2'));
  });

  it('should escape special characters in plain text', () => {
    const input = 'Price: $100 (discounted)';
    const result = convertToMarkdownV2(input);
    assert.ok(result.includes('\\(discounted\\)'));
  });

  it('should handle headings as bold', () => {
    const input = '# Title\n## Subtitle';
    const result = convertToMarkdownV2(input);
    assert.ok(result.includes('*Title*'));
    assert.ok(result.includes('*Subtitle*'));
  });

  it('should return empty string for empty input', () => {
    const result = convertToMarkdownV2('');
    assert.equal(result, '');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /home/jeffwweee/jef/dev-workspace/modules/bots/packages/gateway && npm run build && node --test test/markdown.test.ts`
Expected: FAIL with "Cannot find module '../dist/services/markdown.js'"

**Step 3: Write minimal implementation**

```typescript
// src/services/markdown.ts
import { convert } from 'telegram-markdown-v2';

/**
 * Convert standard Markdown to Telegram MarkdownV2 format
 * @param markdown - Standard Markdown text
 * @returns Telegram MarkdownV2 formatted text
 */
export function convertToMarkdownV2(markdown: string): string {
  if (!markdown || markdown.trim() === '') {
    return '';
  }
  return convert(markdown, 'escape');
}
```

**Step 4: Build and run test to verify it passes**

Run: `cd /home/jeffwweee/jef/dev-workspace/modules/bots/packages/gateway && npm run build && node --test test/markdown.test.ts`
Expected: All tests pass

**Step 5: Commit**

```bash
git add modules/bots/packages/gateway/src/services/markdown.ts modules/bots/packages/gateway/test/markdown.test.ts
git commit -m "feat(gateway): add markdown conversion service with tests"
```

---

## Task 3: Integrate Conversion into handleReply

**Files:**
- Modify: `modules/bots/packages/gateway/src/routes/webhook.ts:177-234`
- Modify: `modules/bots/packages/gateway/test/webhook.test.ts`

**Step 1: Add test for automatic conversion**

Add to `test/webhook.test.ts`:

```typescript
describe('Reply Endpoint with Markdown Conversion', () => {
  let app: any;

  before(async () => {
    app = await createServer();
  });

  it('should convert markdown to MarkdownV2 in reply', async () => {
    const response = await request(app)
      .post('/reply')
      .send({
        bot_id: 'test-bot',
        chat_id: 123456,
        text: 'This is **bold** and *italic* text',
        parse_mode: 'MarkdownV2',
      });

    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
    // The converted text should have Telegram-style formatting
    assert.ok(response.body.text.includes('*bold*'));
    assert.ok(response.body.text.includes('_italic_'));
  });

  it('should skip conversion when skip_conversion is true', async () => {
    const response = await request(app)
      .post('/reply')
      .send({
        bot_id: 'test-bot',
        chat_id: 123456,
        text: 'Pre\\-escaped **text**',
        parse_mode: 'MarkdownV2',
        skip_conversion: true,
      });

    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
    // Text should remain unchanged
    assert.ok(response.body.text.includes('Pre\\-escaped'));
    assert.ok(response.body.text.includes('**text**'));
  });

  it('should not convert when parse_mode is not MarkdownV2', async () => {
    const response = await request(app)
      .post('/reply')
      .send({
        bot_id: 'test-bot',
        chat_id: 123456,
        text: 'This is **bold** text',
        parse_mode: 'HTML',
      });

    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
    // Text should remain unchanged
    assert.ok(response.body.text.includes('**bold**'));
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /home/jeffwweee/jef/dev-workspace/modules/bots/packages/gateway && npm run build && node --test test/webhook.test.ts`
Expected: Some tests fail (conversion not yet implemented)

**Step 3: Modify handleReply to use conversion**

Update `src/routes/webhook.ts`:

```typescript
// Add import at top of file
import { convertToMarkdownV2 } from '../services/markdown.js';

// In handleReply function, replace the template handling section:
export async function handleReply(req: Request, res: Response): Promise<void> {
  try {
    const { bot_id, chat_id, text, template, parse_mode, inbox_id, reply_to, skip_conversion } = req.body;

    if (!bot_id || !chat_id || !text) {
      res.status(400).json({ error: 'Missing required fields: bot_id, chat_id, text' });
      return;
    }

    if (text.length > 4096) {
      res.status(400).json({ error: 'Text exceeds 4096 character limit' });
      return;
    }

    const logger = createLoggerWithBot('reply', bot_id);
    const redis = getRedisClient(process.env.REDIS_URL || 'redis://localhost:6379');

    // Apply template if specified
    let finalText = text;
    if (template) {
      const templates: Record<string, (t?: string) => string> = {
        ack: () => 'Got it, working on it...',
        done: (t) => `Done! ${t || ''}`,
        clarify: (t) => `I need more info: ${t || ''}`,
        error: (t) => `Error: ${t || 'Unknown error'}`,
      };
      if (templates[template]) {
        finalText = templates[template](text);
      }
    }

    // Convert to MarkdownV2 if parse_mode is MarkdownV2 and skip_conversion is not set
    if (parse_mode === 'MarkdownV2' && !skip_conversion) {
      finalText = convertToMarkdownV2(finalText);
      logger.debug({ originalLength: text.length, convertedLength: finalText.length }, 'Converted markdown to MarkdownV2');
    }

    // Build outbox message
    const message: OutboxMessage = {
      bot_id,
      chat_id,
      text: finalText,
      parse_mode: parse_mode || 'MarkdownV2',
      reply_to,
      inbox_id,
    };

    // Publish to outbox
    await redis.publish(REDIS_KEYS.OUTBOX_CHANNEL, JSON.stringify(message));
    logger.info({ chatId: chat_id }, 'Published reply to outbox');

    // Ack the inbox message if provided
    if (inbox_id) {
      await ackInboxMessage(redis, inbox_id);
      logger.debug({ inboxId: inbox_id }, 'Acked inbox message');
    }

    res.status(200).json({ ok: true, text: finalText.substring(0, 100) });
  } catch (error) {
    const logger = createLogger('reply');
    logger.error({ error }, 'Error handling reply');
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

**Step 4: Build and run tests**

Run: `cd /home/jeffwweee/jef/dev-workspace/modules/bots/packages/gateway && npm run build && node --test test/webhook.test.ts`
Expected: All tests pass

**Step 5: Commit**

```bash
git add modules/bots/packages/gateway/src/routes/webhook.ts modules/bots/packages/gateway/test/webhook.test.ts
git commit -m "feat(gateway): integrate markdown conversion in reply endpoint"
```

---

## Task 4: Update telegram-reply Skill Documentation

**Files:**
- Modify: `.claude/skills/telegram-reply/README.md` (or skill doc file)

**Step 1: Update skill documentation**

Update the skill to reflect the new behavior:

```markdown
## Markdown Conversion (Automatic)

The gateway now automatically converts standard Markdown to Telegram MarkdownV2 format.
You can write clean Markdown without worrying about escaping special characters.

### New Request Body

| Field | Type | Description |
|-------|------|-------------|
| `skip_conversion` | boolean | Skip automatic conversion (default: false) |

### Examples

**Standard Markdown (Recommended)**
```bash
/telegram-reply "This is **bold** and *italic* text with `code`"
```

The gateway converts:
- `**bold**` → `*bold*`
- `*italic*` → `_italic_`
- `- item` → `• item`
- `# Heading` → `*Heading*`

**Pre-escaped Text (Legacy)**
```bash
/telegram-reply "Pre\\-escaped text" --skip-conversion
```
```

**Step 2: Commit**

```bash
git add .claude/skills/telegram-reply/README.md
git commit -m "docs(skill): update telegram-reply with auto-conversion docs"
```

---

## Task 5: Manual Verification

**Step 1: Build gateway**

Run: `cd /home/jeffwweee/jef/dev-workspace/modules/bots/packages/gateway && npm run build`

**Step 2: Test via curl**

```bash
curl -X POST 'http://localhost:3100/reply' \
  -H 'Content-Type: application/json' \
  -d '{
    "bot_id": "pichu",
    "chat_id": 195061634,
    "text": "**Test Message**\n\nThis has *italic*, `code`, and a [link](https://example.com).\n\n- Item 1\n- Item 2",
    "parse_mode": "MarkdownV2"
  }'
```

Expected: Message sends with proper formatting (no escaped characters visible in Telegram)

**Step 3: Mark complete**

---

## Summary

| Task | Description | Files Changed |
|------|-------------|---------------|
| 1 | Install dependency | `package.json` |
| 2 | Create conversion utility | `src/services/markdown.ts`, `test/markdown.test.ts` |
| 3 | Integrate into handleReply | `src/routes/webhook.ts`, `test/webhook.test.ts` |
| 4 | Update skill docs | `.claude/skills/telegram-reply/README.md` |
| 5 | Manual verification | None |

**Benefits:**
- Write standard Markdown, get proper Telegram formatting
- No more manual escaping of special characters
- Centralized conversion logic in gateway
- `skip_conversion` flag for edge cases
