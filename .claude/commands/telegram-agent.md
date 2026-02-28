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

3. If `--poll` is set:
   - Call the polling function from the telegram-agent skill
   - Wait up to `--block-ms` for a message
   - If message received, display it in format:
     ```
     📨 New message from @username (private chat 123456):
     > Message text here
     ```
   - Store message context (messageId, botId, chatId, etc.) for reply

4. If no message and just identity setup, confirm ready state

Output format:
```
## Telegram Agent

**Identity:** {name} ({who})
**Style:** {response-style}
**Polling:** yes/no
**Message:** (if received)
```
