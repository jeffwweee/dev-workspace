#!/bin/bash
#
# Telegram Gateway Stop Script
#
# Usage:
#   ./bin/stop-gateway.sh              # Stop gateway gracefully
#   ./bin/stop-gateway.sh --force      # Force kill
#   ./bin/stop-gateway.sh --status     # Check status only
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

TMUX_SESSION="telegram-gateway"
SERVICE_NAME="telegram-gateway"

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_ok() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_err() { echo -e "${RED}[ERR]${NC} $1"; }

# Parse arguments
MODE="stop"
while [[ $# -gt 0 ]]; do
    case $1 in
        --force|-f) MODE="force" ;;
        --status|-s) MODE="status" ;;
        -h|--help)
            echo "Usage: $0 [--force|--status]"
            echo "  --force, -f   Force kill gateway"
            echo "  --status, -s  Check status only"
            exit 0
            ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
    shift
done

# Check if running via systemd
check_systemd() {
    systemctl is-active "$SERVICE_NAME" &>/dev/null 2>&1
}

# Check if running in tmux
check_tmux() {
    tmux has-session -t "$TMUX_SESSION" 2>/dev/null
}

# Check for orphan gateway processes
find_gateway_pids() {
    pgrep -f "telegram-gateway.ts" 2>/dev/null || true
}

get_status() {
    echo ""
    echo "========================================"
    echo "  Telegram Gateway Status"
    echo "========================================"
    echo ""

    local running=false

    # Check systemd
    if check_systemd; then
        log_ok "Running via systemd service: $SERVICE_NAME"
        systemctl status "$SERVICE_NAME" --no-pager -l 2>/dev/null | head -10
        running=true
    fi

    # Check tmux
    if check_tmux; then
        log_ok "Running in tmux session: $TMUX_SESSION"
        running=true
    fi

    # Check orphan processes
    local pids
    pids=$(find_gateway_pids)
    if [[ -n "$pids" ]]; then
        log_warn "Found gateway process(es): $pids"
        ps -p "$pids" -o pid,etime,cmd 2>/dev/null | head -5
        running=true
    fi

    if [[ "$running" == "false" ]]; then
        log_info "Gateway is not running"
    fi

    echo ""
}

stop_systemd() {
    log_info "Stopping systemd service..."
    sudo systemctl stop "$SERVICE_NAME"
    log_ok "Systemd service stopped"
}

stop_tmux() {
    log_info "Stopping tmux session..."
    if [[ "$MODE" == "force" ]]; then
        tmux kill-session -t "$TMUX_SESSION" 2>/dev/null || true
        log_ok "Tmux session force killed"
    else
        # Send SIGINT for graceful shutdown
        tmux send-keys -t "$TMUX_SESSION" C-c 2>/dev/null || true
        sleep 2
        # Check if still running
        if check_tmux; then
            log_warn "Session still running, killing..."
            tmux kill-session -t "$TMUX_SESSION"
        fi
        log_ok "Tmux session stopped"
    fi
}

stop_orphans() {
    local pids
    pids=$(find_gateway_pids)

    if [[ -n "$pids" ]]; then
        log_warn "Killing orphan processes: $pids"
        if [[ "$MODE" == "force" ]]; then
            kill -9 $pids 2>/dev/null || true
        else
            kill $pids 2>/dev/null || true
            sleep 2
            # Force kill if still running
            pids=$(find_gateway_pids)
            if [[ -n "$pids" ]]; then
                log_warn "Processes didn't exit, force killing..."
                kill -9 $pids 2>/dev/null || true
            fi
        fi
        log_ok "Orphan processes killed"
    fi
}

main() {
    case $MODE in
        status)
            get_status
            exit 0
            ;;
        stop|force)
            echo ""
            echo "========================================"
            echo "  Stopping Telegram Gateway"
            echo "========================================"
            echo ""

            local stopped=false

            # Stop systemd first
            if check_systemd; then
                stop_systemd
                stopped=true
            fi

            # Stop tmux
            if check_tmux; then
                stop_tmux
                stopped=true
            fi

            # Kill orphans
            local pids
            pids=$(find_gateway_pids)
            if [[ -n "$pids" ]]; then
                stop_orphans
                stopped=true
            fi

            if [[ "$stopped" == "false" ]]; then
                log_info "Gateway is not running"
            fi

            echo ""
            log_ok "Done"
            ;;
    esac
}

main
