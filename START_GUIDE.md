# Quick Start Guide

## Starting the Orchestrator

```bash
# Start the orchestrator (runs in foreground)
npx tsx bin/cc-orch.ts start

# Or to check status first
npx tsx bin/cc-orch.ts status
```

## Starting Telegram Bots

### 1. Set Environment Variables

```bash
# Add to ~/.zshrc or ~/.bashrc
export PICHU_BOT_TOKEN="your-token-from-botfather"
export PIKACHU_BOT_TOKEN="your-token-from-botfather"
export RAICHU_BOT_TOKEN="your-token-from-botfather"
export BULBASAUR_BOT_TOKEN="your-token-from-botfather"
export CHARMANDER_BOT_TOKEN="your-token-from-botfather"
```

### 2. Start Individual Telegram Agents

```bash
# From dev-workspace root
cd modules/bots

# Start orchestrator bot (pichu)
./scripts/start-telegram-agent.sh pichu "orchestrator" professional sonnet

# Start backend agent (pikachu) - in another terminal
./scripts/start-telegram-agent.sh pikachu "backend developer" professional sonnet

# Start frontend agent (raichu)
./scripts/start-telegram-agent.sh raichu "frontend developer" professional sonnet

# Start QA agent (bulbasaur)
./scripts/start-telegram-agent.sh bulbasaur "QA engineer" professional sonnet

# Start review-git agent (charmander)
./scripts/start-telegram-agent.sh charmander "code reviewer" professional sonnet
```

### 3. Alternative: Manual Start in tmux

```bash
# Create tmux session
tmux new-session -s cc-pichu

# Start Claude with telegram-agent
claude --dangerously-skip-permissions --model sonnet

# Inside Claude, run:
/telegram-agent --name pichu --who "orchestrator" --response-style professional
```

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────┐
│  YOUR TERMINAL                                              │
│  ┌─────────────────┐    ┌─────────────────────────────────┐│
│  │ cc-orch.ts      │    │ tmux sessions (Telegram agents) ││
│  │ start           │    │ cc-pichu, cc-backend, etc.      ││
│  │ (orchestrator)  │    │ (each runs Claude Code)         ││
│  └─────────────────┘    └─────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
            │                           │
            ▼                           ▼
┌─────────────────┐         ┌─────────────────┐
│  state/         │         │  Telegram API   │
│  - pending/     │         │  (bot tokens)   │
│  - memory/      │         └─────────────────┘
│  - progress/    │
└─────────────────┘
```

## Quick Commands

```bash
# CLI
npx tsx bin/cc-orch.ts status          # Check orchestrator status
npx tsx bin/cc-orch.ts list            # List running agents
npx tsx bin/cc-orch.ts submit TASK-001 # Submit a task
npx tsx bin/cc-orch.ts queue backend   # Check backend queue

# Telegram (inside Claude Code session)
/telegram-agent --poll                 # Poll for new messages
/telegram-reply "Your response"        # Send a reply
```

## Files to Know

| File | Purpose |
|------|---------|
| `config/orchestration.yml` | Bot tokens, workflows, limits |
| `state/memory/*.md` | Agent memory files |
| `state/pending/*.json` | Agent task queues |
| `modules/bots/scripts/start-telegram-agent.sh` | Bot startup script |

## Getting Bot Tokens

1. Open Telegram and search for **@BotFather**
2. Send `/newbot` and follow the prompts
3. Copy the token (format: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)
4. Set as environment variable or add to `config/orchestration.yml`
