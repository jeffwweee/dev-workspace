Poll for Telegram messages and reply to conversations.

Usage:
- `/telegram-reply` — Poll for new messages
- `/telegram-reply <text>` — Send reply to last conversation

Arguments:
- $ARGUMENTS — Reply text (optional, if empty just polls)

Steps:
1. If $ARGUMENTS is empty:
   - Call `mcp__tg-agent__telegram_poll` to get pending messages
   - Display messages to user
   - Exit

2. If $ARGUMENTS has text:
   - Call `mcp__tg-agent__telegram_send` with the text
   - Call `mcp__tg-agent__telegram_ack` to acknowledge processed messages
   - Report success

Output format:
```
## Telegram Reply

**Action:** poll | send
**Messages:** N
**Status:** ok | error
```
