Send a formatted response to the last polled Telegram conversation via HTTP.

Usage:
- `/telegram-reply <text>` — Send reply with text
- `/telegram-reply --template <name>` — Send reply with template
- `/telegram-reply <text> --template <name>` — Send text formatted with template

Arguments:
- `$ARGUMENTS` — Reply text (required unless using template alone)
- `--template` — Template name: ack, done, clarify, error
- `--no-ack` — Skip message acknowledgement (default: false)

Templates:
- `ack` — "Got it, working on it..." — Acknowledge request
- `done` — "Done! {text}" — Task completed
- `clarify` — "I need more info: {text}" — Need clarification
- `error` — "Error: {text}" — Report error

Steps:
1. Parse $ARGUMENTS to extract text, template, and --no-ack flag

2. Get the message context from the last poll:
   - bot_id: The bot that received the message
   - chat_id: The chat where the message came from
   - inbox_id: The Redis stream entry ID (for acknowledgement)
   - reply_to: The message ID to reply to (if any)

3. Send the reply using curl to the gateway:
   ```bash
   curl -s -X POST http://localhost:3100/reply \
     -H "Content-Type: application/json" \
     -d '{
       "bot_id": "<bot_id>",
       "chat_id": <chat_id>,
       "text": "<text or empty if template only>",
       "template": "<template or omit>",
       "inbox_id": "<inbox_id unless --no-ack>",
       "reply_to": <reply_to or omit>
     }'
   ```

4. Report the result

Output format:
```
## Telegram Reply

**To:** chat <chat_id>
**Text:** {response preview}
**Status:** sent | error
```

IMPORTANT: Always use curl to localhost:3100/reply - do NOT run node commands or spawn bash processes for sending.
