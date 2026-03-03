# Dev-Workspace Complete Setup Guide

> **Purpose:** This guide enables users to set up the complete dev-workspace environment including Telegram bot integration. It can be dumped into a new Claude Code session for guided setup, or converted to a shell script interface.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start (One-Liner)](#quick-start)
3. [Phase 1: Dev-Workspace Setup](#phase-1-dev-workspace-setup)
4. [Phase 2: Telegram Bot Setup](#phase-2-telegram-bot-setup)
5. [Phase 3: Cloudflare Tunnel Setup](#phase-3-cloudflare-tunnel-setup)
6. [Phase 4: Service Orchestration](#phase-4-service-orchestration)
7. [Verification & Testing](#verification--testing)
8. [Troubleshooting](#troubleshooting)
9. [Claude Code Prompt Template](#claude-code-prompt-template)

---

## Prerequisites

### System Requirements

| Requirement | Description |
|-------------|-------------|
| Node.js | v18+ (LTS recommended) |
| npm | v9+ |
| Redis | v6+ running on localhost:6379 |
| Git | For cloning and version control |
| tmux | For session management |
| cloudflared | For Cloudflare tunnel |

### User Must Provide

| Item | Description | How to Get |
|------|-------------|------------|
| Telegram Bot Token(s) | One per bot from @BotFather | Create via @BotFather on Telegram |
| Telegram User ID | Your numeric user ID | Message @userinfobot on Telegram |
| Group Chat ID (optional) | For group bot access | Add @RawDataBot to group |
| Cloudflare Tunnel ID | From Cloudflare Zero Trust | Create via `cloudflared tunnel login` |
| Domain | Your domain managed by Cloudflare | Must be on Cloudflare DNS |

### Verify Prerequisites

```bash
# Check Node.js
node --version  # Should be v18+

# Check npm
npm --version   # Should be v9+

# Check Redis
redis-cli ping  # Should return PONG

# Check tmux
tmux -V         # Should show version

# Check cloudflared
cloudflared --version
```

---

## Quick Start

For users who want to paste into Claude Code and have it set everything up:

```markdown
I need to set up the complete dev-workspace with Telegram bot integration.

Please follow the setup guide at docs/SETUP.md and help me configure:

1. Dev-workspace (npm install, build)
2. Telegram bots (I have [N] bots)
3. Cloudflare tunnel (domain: [YOUR_DOMAIN])
4. All services running in tmux

Here is my configuration:
- Bot tokens: [TOKEN_1], [TOKEN_2]
- Telegram user ID: [YOUR_ID]
- Group chat ID (optional): [GROUP_ID]
- Tunnel domain: [YOUR_SUBDOMAIN.yourdomain.cc]
```

---

## Phase 1: Dev-Workspace Setup

### Step 1.1: Clone and Install

```bash
# Clone the repository
git clone <repo-url> ~/jef/dev-workspace
cd ~/jef/dev-workspace

# Install dependencies
npm install

# Build TypeScript
npm run build

# Verify CLI works
node bin/dw.js --help
```

### Step 1.2: Initialize Session

```bash
# Create a new session
node bin/dw.js init

# Check status
node bin/dw.js status
```

### Step 1.3: Initialize tg-bots Submodule

```bash
# Initialize and update git submodules
git submodule update --init --recursive

# Install tg-bots dependencies
cd modules/bots
npm install
npm run build
cd ../..
```

### Step 1.4: Register tg-bots Project

```bash
# Register the tg-bots module as a project
node bin/dw.js add tg-bots --path modules/bots

# Verify registration
node bin/dw.js status
```

---

## Phase 2: Telegram Bot Setup

### Step 2.1: Create Bot Configuration

Create `modules/bots/config/bots.yaml`:

```yaml
# Telegram Bot Gateway Configuration
# Replace placeholders with your actual values

gateway:
  port: 3100
  host: "0.0.0.0"
  redis:
    url: "redis://localhost:6379"
    inbox_stream: "tg:inbox"
    outbox_channel: "tg:outbox"
  message:
    claim_timeout_ms: 30000
    max_retries: 3
    retry_delay_ms: 1000

bots:
  # First bot configuration
  - name: "alpha-bot"
    username: "alpha_bot"              # Bot username from @BotFather
    token: "YOUR_ALPHA_BOT_TOKEN"      # Bot token from @BotFather
    webhook_path: "/webhook/alpha-bot"
    tmux:
      session: "cc-alpha"              # tmux session name
      window: 0
      pane: 0
    wake_command: "/telegram-reply"
    permissions:
      allowed_chats: [YOUR_USER_ID]    # Your Telegram user ID
      admin_users: [YOUR_USER_ID]      # Admin user IDs
      rate_limit:
        max_messages: 20
        window_seconds: 60

  # Add additional bots as needed
  # - name: "beta-bot"
  #   username: "beta_bot"
  #   token: "YOUR_BETA_BOT_TOKEN"
  #   ...

logging:
  level: "info"
  format: "pretty"
```

### Step 2.2: Configuration Fields Explained

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Internal identifier for the bot |
| `username` | Yes | Telegram bot username (without @) |
| `token` | Yes | Bot API token from @BotFather |
| `webhook_path` | Yes | URL path for webhook (must be unique) |
| `tmux.session` | Yes | tmux session name for this bot's CC instance |
| `tmux.window` | Yes | Window index (default: 0) |
| `tmux.pane` | Yes | Pane index (default: 0) |
| `wake_command` | Yes | Command to wake the telegram-reply skill |
| `allowed_chats` | Yes | Array of chat IDs that can interact with bot |
| `admin_users` | Yes | Array of admin user IDs |
| `rate_limit.max_messages` | No | Max messages per window |
| `rate_limit.window_seconds` | No | Rate limit window in seconds |

### Step 2.3: Get Required IDs

```bash
# Get your Telegram User ID:
# 1. Open Telegram
# 2. Search for @userinfobot
# 3. Send any message
# 4. It will reply with your user ID

# Get Group Chat ID:
# 1. Add @RawDataBot to your group
# 2. Send any message in the group
# 3. Check @RawDataBot's private reply for chat_id
# 4. Remove @RawDataBot from group
```

---

## Phase 3: Cloudflare Tunnel Setup

### Step 3.1: Install cloudflared

```bash
# Linux (Debian/Ubuntu)
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb

# Or macOS
brew install cloudflare/cloudflare/cloudflared
```

### Step 3.2: Authenticate with Cloudflare

```bash
# Login to Cloudflare (opens browser)
cloudflared tunnel login

# This creates a certificate at ~/.cloudflared/cert.pem
```

### Step 3.3: Create Tunnel

```bash
# Create a named tunnel
cloudflared tunnel create minerva

# This returns a tunnel ID like: 65f655fd-8410-417d-a9d6-4b8da687bf82
# Credentials file is created at: ~/.cloudflared/<TUNNEL_ID>.json
```

### Step 3.4: Configure DNS

```bash
# Create DNS route for your tunnel
cloudflared tunnel route dns minerva minerva.yourdomain.cc

# Verify DNS
dig minerva.yourdomain.cc
```

### Step 3.5: Create Tunnel Configuration

Create `~/.cloudflared/config.yml`:

```yaml
tunnel: <YOUR_TUNNEL_ID>
credentials-file: /home/<USER>/.cloudflared/<YOUR_TUNNEL_ID>.json

ingress:
  - hostname: minerva.yourdomain.cc
    service: http://localhost:3100
  - service: http_status:404
```

### Step 3.6: Run Tunnel (Development)

```bash
# Test tunnel manually
cloudflared tunnel run minerva

# Verify it works
curl https://minerva.yourdomain.cc/healthz
```

### Step 3.7: Install as Systemd Service (Production)

```bash
# Create systemd service file
sudo tee /etc/systemd/system/cloudflared.service << 'EOF'
[Unit]
Description=Cloudflare Tunnel
After=network.target

[Service]
Type=notify
ExecStart=/usr/local/bin/cloudflared --config /home/<USER>/.cloudflared/config.yml tunnel run
Restart=on-failure
RestartSec=5s
User=<USER>
Group=<USER>

[Install]
WantedBy=multi-user.target
EOF

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable cloudflared
sudo systemctl start cloudflared

# Check status
sudo systemctl status cloudflared
```

---

## Phase 4: Service Orchestration

### Step 4.1: Create tmux Sessions

```bash
# Create sessions for each bot + gateway
# For each bot in your config:

# Gateway session
tmux new-session -d -s tg-gateway

# Bot sessions (one per bot)
tmux new-session -d -s cc-alpha
tmux new-session -d -s cc-beta
# ... add more as needed
```

### Step 4.2: Start Gateway Service

```bash
# Attach to gateway session
tmux send-keys -t tg-gateway "cd ~/jef/dev-workspace/modules/bots" Enter
tmux send-keys -t tg-gateway "CC_CONFIG_PATH=./config/bots.yaml npm run start:gateway" Enter

# Verify gateway is running
curl http://localhost:3100/healthz
```

### Step 4.3: Register Webhooks

```bash
# For each bot, register the webhook with Telegram
# Replace YOUR_BOT_TOKEN and YOUR_DOMAIN

# Alpha bot
curl -s "https://api.telegram.org/bot<ALPHA_TOKEN>/setWebhook?url=https://minerva.yourdomain.cc/webhook/alpha-bot" | jq .

# Beta bot
curl -s "https://api.telegram.org/bot<BETA_TOKEN>/setWebhook?url=https://minerva.yourdomain.cc/webhook/beta-bot" | jq .

# Verify webhooks
curl -s "https://api.telegram.org/bot<ALPHA_TOKEN>/getWebhookInfo" | jq .
```

### Step 4.4: Start Claude Code in Bot Sessions

```bash
# In each bot's tmux session, start Claude Code
# The telegram-reply skill will be invoked when messages arrive

# Example for alpha-bot session:
tmux send-keys -t cc-alpha "cd ~/jef/dev-workspace" Enter
tmux send-keys -t cc-alpha "claude" Enter
# ... Claude Code starts and waits for /telegram-reply command
```

---

## Verification & Testing

### Health Check All Services

```bash
# Redis
redis-cli ping

# Gateway
curl http://localhost:3100/healthz

# Tunnel
curl https://minerva.yourdomain.cc/healthz

# Webhooks
curl -s "https://api.telegram.org/bot<TOKEN>/getWebhookInfo" | jq '.result.url'
```

### Test End-to-End Flow

```bash
# 1. Send a message to your bot on Telegram

# 2. Check Redis stream for incoming message
redis-cli XREAD STREAMS tg:inbox 0

# 3. Check gateway logs (in tmux session)
tmux capture-pane -t tg-gateway -p

# 4. Verify the message appears in the stream
```

### Test Checklist

- [ ] Redis running and responding
- [ ] Gateway health check returns `{"status":"ok"}`
- [ ] Tunnel URL returns 200 on health endpoint
- [ ] Webhooks registered (getWebhookInfo shows URL)
- [ ] Message sent to bot appears in Redis stream
- [ ] Claude Code session can poll messages with `/telegram-reply`

---

## Troubleshooting

### Common Issues

#### Gateway won't start

```bash
# Check if port is in use
lsof -i :3100

# Check Redis connection
redis-cli ping

# Check config path
echo $CC_CONFIG_PATH
```

#### Webhook registration fails

```bash
# Telegram only allows ports 80, 88, 443, 8443
# Don't include port in webhook URL - tunnel handles routing

# Wrong:
curl ".../setWebhook?url=https://domain.cc:3100/webhook/bot"

# Right:
curl ".../setWebhook?url=https://domain.cc/webhook/bot"
```

#### DNS not resolving

```bash
# Check Cloudflare DNS route
cloudflared tunnel route dns <tunnel-name> <hostname>

# Verify with dig
dig <hostname>

# Check tunnel is running
cloudflared tunnel list
```

#### Messages not appearing in Redis

```bash
# Check webhook was received
curl -s "https://api.telegram.org/bot<TOKEN>/getWebhookInfo" | jq '.result.pending_update_count'

# Check gateway logs
tmux capture-pane -t tg-gateway -p | tail -50

# Check Redis stream directly
redis-cli XINFO STREAM tg:inbox
```

---

## Claude Code Prompt Template

Copy this entire prompt and paste into a new Claude Code session:

```markdown
# Dev-Workspace Setup Request

I need help setting up the complete dev-workspace environment with Telegram bot integration.

## My Configuration

- **Number of bots:** [1/2/3]
- **Bot tokens:**
  - Alpha: [TOKEN]
  - Beta: [TOKEN] (if applicable)
- **My Telegram User ID:** [YOUR_ID]
- **Group Chat ID (optional):** [GROUP_ID]
- **Tunnel domain:** [subdomain.yourdomain.cc]
- **Tunnel name:** [tunnel-name]

## Tasks

Please help me complete these steps:

1. **Dev-Workspace Setup**
   - Run `npm install` and `npm run build`
   - Initialize session with `node bin/dw.js init`
   - Initialize git submodules for modules/bots
   - Build tg-bots packages

2. **Telegram Bot Configuration**
   - Create `modules/bots/config/bots.yaml` with my bot details
   - Configure proper permissions and rate limits

3. **Cloudflare Tunnel**
   - Verify tunnel configuration at `~/.cloudflared/config.yml`
   - Test tunnel connectivity

4. **Service Orchestration**
   - Create tmux sessions: tg-gateway, cc-alpha (, cc-beta)
   - Start gateway service
   - Register webhooks with Telegram

5. **Verification**
   - Run health checks on all services
   - Test end-to-end message flow

Reference the setup guide at `docs/SETUP.md` for detailed instructions.
```

---

## Service Management Commands

### Start All Services

```bash
#!/bin/bash
# start-all.sh

# Start Redis (if not running)
redis-server --daemonize yes

# Start cloudflared tunnel
sudo systemctl start cloudflared

# Create tmux sessions
tmux new-session -d -s tg-gateway
tmux new-session -d -s cc-alpha
tmux new-session -d -s cc-beta

# Start gateway
tmux send-keys -t tg-gateway "cd ~/jef/dev-workspace/modules/bots && CC_CONFIG_PATH=./config/bots.yaml npm run start:gateway" Enter
```

### Stop All Services

```bash
#!/bin/bash
# stop-all.sh

# Kill tmux sessions
tmux kill-session -t tg-gateway 2>/dev/null
tmux kill-session -t cc-alpha 2>/dev/null
tmux kill-session -t cc-beta 2>/dev/null

# Stop cloudflared
sudo systemctl stop cloudflared
```

### Check All Services

```bash
#!/bin/bash
# check-all.sh

echo "=== Redis ==="
redis-cli ping

echo "=== Cloudflared ==="
sudo systemctl is-active cloudflared

echo "=== Tmux Sessions ==="
tmux list-sessions 2>/dev/null || echo "No sessions"

echo "=== Gateway Health ==="
curl -s http://localhost:3100/healthz

echo "=== Tunnel Health ==="
curl -s https://minerva.yourdomain.cc/healthz
```

---

## Architecture Overview

```
                         ┌─────────────────┐
                         │   Telegram      │
                         │   Servers       │
                         └────────┬────────┘
                                  │
                                  │ HTTPS Webhook
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Tunnel                         │
│                 (minerva.yourdomain.cc)                      │
└────────────────────────────┬────────────────────────────────┘
                             │
                             │ http://localhost:3100
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Gateway (Express)                         │
│                    Port 3100                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ /healthz    │  │ /webhook/*  │  │ /metrics    │         │
│  └─────────────┘  └──────┬──────┘  └─────────────┘         │
└──────────────────────────┼──────────────────────────────────┘
                           │
                           │ XADD tg:inbox
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      Redis                                  │
│  ┌─────────────────┐       ┌─────────────────┐             │
│  │ Stream: tg:inbox│       │ Channel: tg:outbox│            │
│  └────────┬────────┘       └────────┬────────┘             │
└───────────┼─────────────────────────┼───────────────────────┘
            │                         │
            │ XREADGROUP              │ SUBSCRIBE
            ▼                         │
┌───────────────────────┐             │
│   tmux: cc-alpha      │             │
│   ┌─────────────────┐ │             │
│   │ Claude Code     │ │             │
│   │ + telegram-reply│◄┼─────────────┘
│   │ skill           │ │
│   └─────────────────┘ │
└───────────────────────┘
```

---

**Last Updated:** 2026-02-27
**Version:** 1.0.0
