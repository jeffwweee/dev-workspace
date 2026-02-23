# Telegram MarkdownV2 Formatting

Telegram's MarkdownV2 style requires escaping certain special characters. This skill handles escaping automatically.

## Characters That Need Escaping

All these characters must be escaped with `\` in MarkdownV2:

```
_ * [ ] ( ) ~ ` > # + - = | { } . !
```

## Safe Formatting

These work without escaping (the skill handles it):

| Format | Syntax | Result |
|--------|--------|--------|
| **Bold** | `*text*` | Bold text |
| *Italic* | `_text_` | Italic text |
| `Monospace` | `` `text` `` | Inline code |
| [Link](url) | `[text](url)` | Clickable link |

## Automatic Escaping

When using `telegram-reply`, all special characters in your message are automatically escaped:

**Input:**
```
Task V2-017 is 50% complete!
Files: src/config.ts, src/gateway.ts
```

**Sent to Telegram:**
```
Task V2\-017 is 50% complete\!
Files: src/config\.ts, src/gateway\.ts
```

## Manual Escaping

If you need to manually escape text:

```javascript
// Characters to escape
const SPECIAL_CHARS = /[_*[\]()~`>#+-=|{}.!]/g;

function escapeMarkdown(text) {
  return text.replace(SPECIAL_CHARS, '\\$&');
}
```

## Block Elements

### Headers
```
*Header Text*
```
(Use bold instead of # headers)

### Lists
```
• Item 1
• Item 2
• Item 3
```
(Use bullet • instead of - or *)

### Code Blocks
```
```
code here
```
```
(Use triple backticks, but escape content)

## Common Patterns

### Status Message
```
📊 *Status Update*

Task: V2\-017
Progress: 75%
Status: In progress
```

### Error Message
```
⚠️ *Error*

Failed to process request\.
Reason: Connection timeout
```

### Success Message
```
✅ *Complete*

Task finished successfully\.
Duration: 5 minutes
```

### List of Items
```
*Files changed:*
• src/config\.ts
• src/gateway\.ts
• src/server\.ts
```

## Character Limits

- Single message: 4096 characters
- The skill auto-chunks longer messages
- Each chunk is prefixed with `[1/N]`

## Best Practices

1. **Keep it concise** — Telegram is for quick updates
2. **Use emoji sparingly** — Just for status indicators
3. **Test complex formatting** — Some combinations may not render correctly
4. **Use templates** — Pre-escaped and tested
