Set up telegram-agent identity and poll for messages.

Usage:
- `/telegram-agent --name <bot> --who "<role>" --response-style <style>` — Set identity
- `/telegram-agent --poll` — Poll for pending messages
- `/telegram-agent --name <bot> ... --poll` — Set identity and poll

Arguments:
- `--name` — Bot identifier (required for identity setup)
- `--who` — Role/persona (default: "AI assistant")
- `--response-style` — Communication style (default: "helpful")
- `--poll` — Poll for messages after setting identity
- `--block-ms` — Poll timeout in ms (default: 5000)

Steps:
1. Parse arguments to extract name, who, response-style, poll flag, block-ms

2. If `--name` is provided:
   - Generate identity prompt: "You are {name}, a {who} AI assistant. Response style: {response-style}..."
   - Adopt this persona for the session
   - Inform user of the identity setup

3. If `--poll` is set, poll via gateway API:
   ```bash
   curl -s http://localhost:3100/poll | jq .
   ```

4. If message received, display it and STORE THE CONTEXT:
   ```
   📨 New message from @username (private chat 123456):
   > Message text here

   **Context for reply:**
   - bot_id: <name>
   - chat_id: <chat_id>
   - inbox_id: <stream_id>
   - reply_to: <message_id or null>
   ```

5. Keep this context in memory for the next `/telegram-reply` command

Output format:
```
## Telegram Agent

**Identity:** {name} ({who})
**Style:** {response-style}
**Polling:** yes/no
**Message:** (if received with full context)
```

IMPORTANT: After polling, remember the bot_id, chat_id, inbox_id, and reply_to values - they are needed for /telegram-reply.
