# Telegram Gateway Architecture Decision

**Date:** 2026-03-01
**Status:** Approved
**Decision:** Keep Express Gateway (don't migrate to MCP)

---

## Overview

This document captures the architectural decision to keep the custom Express gateway for Telegram integration rather than migrating to a Telegram MCP server.

---

## Current Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         TELEGRAM API                                 │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ Webhook (POST)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    EXPRESS GATEWAY (:3100)                           │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ MIDDLEWARE STACK                                              │   │
│  │  1. Security Headers                                          │   │
│  │  2. Telegram IP Validation                                    │   │
│  │  3. Input Sanitization                                        │   │
│  │  4. Rate Limiting (webhook/api)                               │   │
│  │  5. Request Validation                                        │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ SERVICES                                                      │   │
│  │  • Telegram API (circuit breaker)                             │   │
│  │  • Tmux Command Injection                                     │   │
│  │  • Inbox/Outbox (Redis streams)                               │   │
│  │  • Health Checks                                              │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ ROUTES                                                        │   │
│  │  POST /webhook/:botId    → Handle incoming messages           │   │
│  │  GET  /poll              → Poll for pending messages          │   │
│  │  POST /reply             → Send response                      │   │
│  │  GET  /health            → Health status                      │   │
│  │  GET  /ready             → Kubernetes readiness               │   │
│  │  GET  /live              → Kubernetes liveness                │   │
│  │  GET  /metrics           → Prometheus metrics                 │   │
│  │  GET  /admin/errors      → Error tracking                     │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ Redis Streams
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         REDIS                                        │
│                                                                      │
│  tg:inbox:{bot_id}     → Incoming messages (claimed by agents)       │
│  tg:outbox             → Outgoing messages (processed by gateway)    │
│  tg:session:{id}       → Agent session state                         │
│                                                                      │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ tmux send-keys (wake command)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    CLAUDE CODE SESSIONS                              │
│                                                                      │
│  cc-orchestrator    cc-backend    cc-frontend    cc-qa    cc-review │
│       │                 │             │            │          │      │
│  /telegram-agent   /telegram-agent  ...          ...        ...     │
│       --poll            --poll                                         │
│           │                 │                                         │
│           ▼                 ▼                                         │
│  /telegram-reply    /telegram-reply                                  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## MCP Alternative Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         TELEGRAM API                                 │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    TELEGRAM MCP SERVER                               │
│                                                                      │
│  Tools Provided:                                                     │
│  • telegram_send_message(chat_id, text)                              │
│  • telegram_get_updates(offset, limit)                               │
│  • telegram_reply_to(message_id, text)                               │
│                                                                      │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ MCP Protocol (stdio/SSE)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    CLAUDE CODE                                       │
│                                                                      │
│  Single connection point                                             │
│  Polls for messages via MCP tools                                    │
│  No push mechanism                                                   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Feature Comparison

| Feature | Express Gateway | Telegram MCP | Winner |
|---------|-----------------|--------------|--------|
| **Multi-Agent Routing** | Routes to specific tmux sessions by bot role | Single connection | Gateway |
| **Wake Commands** | Injects `/telegram-agent --poll` into idle agents | No push mechanism | Gateway |
| **Circuit Breaker** | 15s timeout, 40% threshold, 60s reset | None | Gateway |
| **Rate Limiting** | Per-endpoint limits | None | Gateway |
| **IP Validation** | Telegram IP range validation | None | Gateway |
| **Input Sanitization** | XSS/injection protection | None | Gateway |
| **Prometheus Metrics** | Request counts, latency, errors | None | Gateway |
| **Health Checks** | /health, /ready, /live | None | Gateway |
| **Error Tracking** | /admin/errors with summary | None | Gateway |
| **Message Ack** | Redis stream ack pattern | Fire-and-forget | Gateway |
| **Templates** | Built into telegram-reply skill | Manual formatting | Gateway |
| **Identity/Persona** | Per-session via CLI args | Global config | Gateway |
| **Zod Validation** | Request/response schemas | None | Gateway |
| **Graceful Shutdown** | Connection drain, in-flight tracking | None | Gateway |

**Score: Gateway 15 - MCP 0**

---

## Decision Rationale

### Why NOT MCP

1. **No Push Mechanism**
   - MCP requires Claude to actively poll for messages
   - Gateway can inject wake commands into idle tmux sessions
   - This is essential for multi-agent orchestration

2. **Single Connection**
   - MCP server provides one connection point
   - Gateway routes to multiple agents based on bot role
   - Multi-agent architecture requires multi-connection routing

3. **No Reliability Patterns**
   - No circuit breaker for API failures
   - No rate limiting for Telegram API limits
   - No message acknowledgement (fire-and-forget)

4. **No Observability**
   - No metrics for monitoring
   - No health checks for Kubernetes
   - No error tracking for debugging

5. **No Security**
   - No IP validation for Telegram webhooks
   - No input sanitization
   - No rate limiting for abuse prevention

### Why Gateway

1. **Production-Grade Reliability**
   ```typescript
   const telegramBreaker = createCircuitBreaker('telegram-api', {
     timeout: 15000,
     errorThresholdPercentage: 40,
     resetTimeout: 60000
   });
   ```

2. **Multi-Agent Routing**
   ```yaml
   bots:
     - name: pikachu
       role: backend
       tmux:
         session: cc-backend
   ```

3. **Wake Command Injection**
   ```typescript
   // Gateway injects this into idle agents
   tmux send-keys -t cc-backend "/telegram-agent --poll" Enter
   ```

4. **Message Acknowledgement**
   ```typescript
   // Prevents message loss
   await redis.xack(`tg:inbox:${botId}`, 'consumer-group', inboxId);
   ```

5. **Observability**
   ```bash
   curl http://localhost:3100/metrics  # Prometheus
   curl http://localhost:3100/health   # Health status
   curl http://localhost:3100/admin/errors  # Error tracking
   ```

---

## Optional: Hybrid Approach

If MCP compatibility is desired, expose an MCP interface alongside the gateway:

```typescript
// Optional MCP server wrapping gateway functionality
import { Server } from '@modelcontextprotocol/sdk';

const mcpServer = new Server({
  name: 'telegram-gateway',
  version: '1.0.0'
}, {
  capabilities: { tools: {} }
});

mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'telegram_send',
      description: 'Send Telegram message via gateway',
      inputSchema: {
        type: 'object',
        properties: {
          chat_id: { type: 'number' },
          text: { type: 'string' }
        }
      }
    },
    {
      name: 'telegram_poll',
      description: 'Poll for messages via gateway',
      inputSchema: { type: 'object' }
    }
  ]
}));

mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'telegram_send') {
    // Forward to gateway
    const response = await fetch('http://localhost:3100/reply', {
      method: 'POST',
      body: JSON.stringify(request.params.arguments)
    });
    return response.json();
  }
});
```

**Benefit:** Standard MCP protocol for third-party integrations while keeping gateway features.

---

## Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| Express Gateway | ✅ Complete | modules/bots/packages/gateway/ |
| Telegram Service | ✅ Complete | Circuit breaker, retry logic |
| Tmux Service | ✅ Complete | Command injection |
| Inbox/Outbox | ✅ Complete | Redis streams |
| Health Checks | ✅ Complete | /health, /ready, /live |
| Metrics | ✅ Complete | Prometheus |
| Rate Limiting | ✅ Complete | Per-endpoint |
| Security Middleware | ✅ Complete | IP validation, sanitization |
| telegram-agent skill | ✅ Complete | Identity + polling |
| telegram-reply skill | ✅ Complete | Templates + validation |

---

## References

- Gateway Source: `modules/bots/packages/gateway/src/`
- Telegram Service: `modules/bots/packages/gateway/src/services/telegram.ts`
- Tmux Service: `modules/bots/packages/gateway/src/services/tmux.ts`
- Skills: `modules/bots/packages/skills/src/telegram-*`
- Config: `config/orchestration.yml`
