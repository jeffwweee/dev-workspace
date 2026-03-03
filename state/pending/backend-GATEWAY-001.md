# GATEWAY-001: Gateway Bot Commands and Reactions

## Priority
High

## Context
From pichu orchestrator session (chat 195061634)

User approved execution of the Gateway enhancement plan on 2026-03-03.

## Plan Reference
See: `docs/plans/2026-03-03-gateway-bot-commands-and-reactions.md`

## Testing Requirements
**CRITICAL: Local testing only - no production services**
- Gateway Port: `3001` (not production 3100)
- Redis DB: `1` (separate from production)
- Use test bot token only
- Test with: `curl localhost:3001/health`

## Implementation Phases

### Phase 1: Commands (P1)
Create command handler infrastructure and implement:
- `/status` - Show agent status (busy, idle, task)
- `/list` - List pending tasks in queue
- `/interrupt` - Cancel current task (tmux injection)
- `/clear` - Clear agent context
- `/compact` - Trigger context compaction

Files to create:
```
packages/gateway/src/commands/
├── index.ts           # Command router
├── status.ts          # /status handler
├── list.ts            # /list handler
├── interrupt.ts       # /interrupt handler
├── clear.ts           # /clear handler
└── compact.ts         # /compact handler
```

### Phase 2: Reactions (P1)
Add emoji reactions for visual feedback:
- 👀 Acknowledged/Seen
- 🔄 Processing/In Progress
- ✅ Completed Successfully
- ❌ Failed/Error

Files to create:
```
packages/gateway/src/reactions/
├── index.ts           # Reaction manager
└── types.ts           # Reaction type definitions
```

### Phase 3: Commands Sync (P2)
Register commands with Telegram BotFather for autocomplete:
- Create commands registry
- Sync on gateway startup
- Add manual sync endpoint

### Phase 4: File Processing (P3)
Handle incoming images and files from Telegram.

### Phase 5: Attachments (P3)
Send file attachments in responses.

### Phase 6: Threading (P4)
Reply threading for conversation context.

## Files to Modify
- `modules/bots/packages/gateway/src/routes/webhook.ts` - Add command/reaction handling
- `modules/bots/packages/gateway/src/index.ts` - Initialize commands and reactions

## Verification
1. Run: `cd modules/bots && pnpm test`
2. Start gateway on port 3001: `GATEWAY_PORT=3001 tsx packages/gateway/src/index.ts`
3. Test commands with curl to localhost:3001
4. Verify reactions appear in Telegram
5. Verify /commands appear in Telegram menu

## Decisions (from plan)
1. Reactions: Keep after completion (don't remove)
2. `/interrupt`: Inject into tmux to stop agent directly
3. `/compact`: Manual only (skill-based context compacting)

## Success Criteria
- [ ] All Phase 1 commands working on port 3001
- [ ] Reactions showing in Telegram
- [ ] Commands synced to BotFather
- [ ] Tests passing
- [ ] No production services touched
