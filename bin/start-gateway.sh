#!/bin/bash
#
# Telegram Gateway Startup Script
#
# Usage:
#   ./bin/start-gateway.sh              # Start in tmux (default)
#   ./bin/start-gateway.sh --fg         # Start in foreground
#   ./bin/start-gateway.sh --check      # Only run checks, don't start
#   ./bin/start-gateway.sh --register   # Only register webhooks
#
# Environment:
#   PICHU_BOT_TOKEN, PIKACHU_BOT_TOKEN, RAICHU_BOT_TOKEN,
#   BULBASAUR_BOT_TOKEN, CHARMANDER_BOT_TOKEN
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Config
TUNNEL_NAME="rx78"
TUNNEL_HOST="rx78.jeffwweee.cc"
GATEWAY_PORT="3100"
TMUX_SESSION="telegram-gateway"
CONFIG_FILE="config/orchestration.yml"

# Bot tokens required
REQUIRED_TOKENS=("PICHU_BOT_TOKEN" "PIKACHU_BOT_TOKEN" "RAICHU_BOT_TOKEN" "BULBASAUR_BOT_TOKEN" "CHARMANDER_BOT_TOKEN")
BOT_NAMES=("pichu" "pikachu" "raichu" "bulbasaur" "charmander")

# Parse arguments
MODE="tmux"
CHECK_ONLY=false
REGISTER_ONLY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --fg) MODE="fg" ;;
        --check) CHECK_ONLY=true ;;
        --register) REGISTER_ONLY=true ;;
        -h|--help)
            echo "Usage: $0 [--fg|--check|--register]"
            echo "  --fg       Run in foreground (no tmux)"
            echo "  --check    Only run pre-flight checks"
            echo "  --register Only register webhooks"
            exit 0
            ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
    shift
done

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_ok() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_err() { echo -e "${RED}[ERR]${NC} $1"; }

# ============================================
# Pre-flight Checks
# ============================================

check_redis() {
    log_info "Checking Redis..."
    if redis-cli ping > /dev/null 2>&1; then
        log_ok "Redis is running"
        return 0
    else
        log_err "Redis is not running. Start with: redis-server"
        return 1
    fi
}

check_tunnel_process() {
    log_info "Checking cloudflared process..."
    if pgrep -x cloudflared > /dev/null; then
        log_ok "Cloudflared process is running"
        return 0
    else
        log_err "Cloudflared not running. Start with: cloudflared tunnel run"
        return 1
    fi
}

check_config() {
    log_info "Checking config file..."
    if [[ -f "$CONFIG_FILE" ]]; then
        log_ok "Config file exists: $CONFIG_FILE"
        return 0
    else
        log_err "Config file not found: $CONFIG_FILE"
        return 1
    fi
}

check_tokens() {
    log_info "Checking bot tokens..."
    local missing=()
    for token in "${REQUIRED_TOKENS[@]}"; do
        if [[ -z "${!token}" ]]; then
            missing+=("$token")
        fi
    done

    if [[ ${#missing[@]} -eq 0 ]]; then
        log_ok "All bot tokens are set"
        return 0
    else
        log_err "Missing tokens: ${missing[*]}"
        return 1
    fi
}

check_gateway_built() {
    log_info "Checking gateway build..."
    local gateway_dist="modules/bots/packages/gateway/dist/index.js"
    if [[ -f "$gateway_dist" ]]; then
        log_ok "Gateway is built"
        return 0
    else
        log_err "Gateway not built. Run: cd modules/bots/packages/gateway && npm run build"
        return 1
    fi
}

# ============================================
# Tunnel Connection Check
# ============================================

check_tunnel_connection() {
    log_info "Checking tunnel connection..."
    local info
    info=$(cloudflared tunnel info "$TUNNEL_NAME" 2>&1)

    # Check for connector lines (indicates active connections)
    if echo "$info" | grep -q "CONNECTOR ID"; then
        local conn_count
        conn_count=$(echo "$info" | grep -c "^[a-f0-9-]\{36\}")
        if [[ "$conn_count" -gt 0 ]]; then
            log_ok "Tunnel $TUNNEL_NAME has $conn_count active connector(s)"
            return 0
        else
            log_warn "Tunnel exists but no active connectors. Waiting..."
            sleep 3
            check_tunnel_connection
        fi
    else
        log_err "Failed to get tunnel info"
        echo "$info"
        return 1
    fi
}

# ============================================
# Webhook Registration
# ============================================

register_webhooks() {
    log_info "Registering webhooks..."

    local failed=()
    for i in "${!BOT_NAMES[@]}"; do
        local bot="${BOT_NAMES[$i]}"
        local token_var="${REQUIRED_TOKENS[$i]}"
        local token="${!token_var}"
        local webhook_url="https://${TUNNEL_HOST}/webhook/${bot}"

        log_info "Registering $bot webhook -> $webhook_url"

        local response
        response=$(curl -s -o /dev/null -w "%{http_code}" \
            "https://api.telegram.org/bot${token}/setWebhook?url=${webhook_url}")

        if [[ "$response" == "200" ]]; then
            # Verify it was set
            local result
            result=$(curl -s "https://api.telegram.org/bot${token}/getWebhookInfo")
            if echo "$result" | jq -e '.result.url' | grep -q "$webhook_url"; then
                log_ok "$bot webhook registered"
            else
                log_warn "$bot webhook registration unclear"
                failed+=("$bot")
            fi
        else
            log_err "$bot webhook failed (HTTP $response)"
            failed+=("$bot")
        fi
    done

    if [[ ${#failed[@]} -eq 0 ]]; then
        log_ok "All webhooks registered successfully"
        return 0
    else
        log_err "Failed webhooks: ${failed[*]}"
        return 1
    fi
}

# ============================================
# Start Gateway
# ============================================

start_gateway() {
    case $MODE in
        tmux)
            if tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
                log_warn "Session $TMUX_SESSION already exists. Attaching..."
                tmux attach -t "$TMUX_SESSION"
            else
                log_info "Starting gateway in tmux session: $TMUX_SESSION"
                tmux new-session -d -s "$TMUX_SESSION" -c "$(pwd)" "npx tsx bin/telegram-gateway.ts"
                log_ok "Gateway started. Attach with: tmux attach -t $TMUX_SESSION"
            fi
            ;;
        fg)
            log_info "Starting gateway in foreground..."
            npx tsx bin/telegram-gateway.ts
            ;;
    esac
}

# ============================================
# Main
# ============================================

main() {
    echo ""
    echo "========================================"
    echo "  Telegram Gateway Startup"
    echo "========================================"
    echo ""

    # Run pre-flight checks
    local checks_passed=true

    check_redis || checks_passed=false
    check_tunnel_process || checks_passed=false
    check_config || checks_passed=false
    check_tokens || checks_passed=false
    check_gateway_built || checks_passed=false

    if [[ "$checks_passed" == "false" ]]; then
        echo ""
        log_err "Pre-flight checks failed. Fix issues above and retry."
        exit 1
    fi

    echo ""
    log_ok "All pre-flight checks passed!"

    # Exit if check-only mode
    if [[ "$CHECK_ONLY" == "true" ]]; then
        exit 0
    fi

    # Check tunnel connection
    echo ""
    check_tunnel_connection || {
        log_err "Tunnel connection not ready"
        exit 1
    }

    # Exit if register-only mode
    if [[ "$REGISTER_ONLY" == "true" ]]; then
        echo ""
        register_webhooks
        exit $?
    fi

    # Register webhooks
    echo ""
    register_webhooks || {
        log_warn "Some webhooks failed, continuing anyway..."
    }

    # Start gateway
    echo ""
    start_gateway
}

main
