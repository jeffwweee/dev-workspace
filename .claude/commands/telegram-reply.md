Send a formatted response to the last polled Telegram conversation.

Usage:
- `/telegram-reply <text>` — Send reply with text
- `/telegram-reply --template <name>` — Send reply with template
- `/telegram-reply <text> --template <name>` — Send text formatted with template
- `/telegram-reply <text> --no-ack` — Send without acknowledging (for multi-part)

Arguments:
- `$ARGUMENTS` — Reply text (required unless using template alone)
- `--template` — Template name: ack, done, clarify, error
- `--parse-mode` — Formatting mode (default: MarkdownV2)
- `--no-ack` — Skip message acknowledgement (default: false)

Templates:
- `ack` — "Got it, working on it..." — Acknowledge request
- `done` — "Done! {text}" — Task completed
- `clarify` — "I need more info: {text}" — Need clarification
- `error` — "Error: {text}" — Report error

Steps:
1. Parse $ARGUMENTS to extract text and flags (--template, --parse-mode, --no-ack)

2. Validate:
   - Must have active message context from previous /telegram-agent --poll
   - Must have either text or template

3. If template specified:
   - Apply template formatting to text
   - Templates handle MarkdownV2 escaping

4. Send reply:
   - Use stored message context (botId, chatId, messageId, replyTo)
   - Publish to Redis outbox
   - Gateway handles actual Telegram API call

5. Acknowledge message (unless --no-ack):
   - Mark original inbox message as processed

Output format:
```
## Telegram Reply

**To:** @username (chat 123456)
**Template:** (if used)
**Text:** {response preview}
**Status:** sent | error
```

Examples:
- `/telegram-reply "Here's your answer!"` — Plain reply
- `/telegram-reply --template ack` — Quick acknowledgment
- `/telegram-reply "Found 3 issues" --template done` — Done with details
- `/telegram-reply "Which file?" --template clarify` — Ask for clarification
