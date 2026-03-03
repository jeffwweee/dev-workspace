#!/bin/bash
#
# Install Telegram Gateway as systemd service
#
# Usage:
#   sudo ./bin/install-service.sh          # Install service
#   sudo ./bin/install-service.sh --remove # Remove service
#

set -e

SERVICE_NAME="telegram-gateway"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
WORKSPACE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPTS_DIR="$WORKSPACE_DIR/bin"

# Parse arguments
REMOVE=false
while [[ $# -gt 0 ]]; do
    case $1 in
        --remove|-r) REMOVE=true ;;
        -h|--help)
            echo "Usage: sudo $0 [--remove]"
            echo "  --remove, -r   Remove the service"
            exit 0
            ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
    shift
done

# Check root
if [[ $EUID -ne 0 ]]; then
    echo "Error: This script must be run as root (use sudo)"
    exit 1
fi

# Get the actual user (even when using sudo)
ACTUAL_USER="${SUDO_USER:-$USER}"
ACTUAL_HOME=$(eval echo "~$ACTUAL_USER")

if $REMOVE; then
    echo "Removing $SERVICE_NAME service..."

    systemctl stop "$SERVICE_NAME" 2>/dev/null || true
    systemctl disable "$SERVICE_NAME" 2>/dev/null || true
    rm -f "$SERVICE_FILE"
    systemctl daemon-reload

    echo "Service removed successfully"
    exit 0
fi

echo "Installing $SERVICE_NAME service..."
echo "Workspace: $WORKSPACE_DIR"
echo "User: $ACTUAL_USER"
echo ""

# Create service file
cat > "$SERVICE_FILE" << EOF
[Unit]
Description=Telegram Gateway for Dev Workspace
After=network.target redis.service cloudflared.service
Wants=redis.service cloudflared.service

[Service]
Type=simple
User=$ACTUAL_USER
Group=$ACTUAL_USER
WorkingDirectory=$WORKSPACE_DIR
Environment="PATH=/usr/local/bin:/usr/bin:/bin"
Environment="NODE_PATH=$ACTUAL_HOME/.npm-global/lib/node_modules"

# Load environment variables from user's profile
EnvironmentFile=-$ACTUAL_HOME/.config/environment.d/*.conf

# Pre-start checks and webhook registration
ExecStartPre=$SCRIPTS_DIR/start-gateway.sh --check
ExecStartPre=$SCRIPTS_DIR/start-gateway.sh --register

# Start gateway in foreground
ExecStart=$SCRIPTS_DIR/start-gateway.sh --fg

# Graceful shutdown
KillSignal=SIGINT
TimeoutStopSec=10

# Restart policy
Restart=on-failure
RestartSec=5

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$SERVICE_NAME

[Install]
WantedBy=multi-user.target
EOF

# Set permissions
chmod 644 "$SERVICE_FILE"

# Reload systemd
systemctl daemon-reload

# Enable service
systemctl enable "$SERVICE_NAME"

echo ""
echo "========================================"
echo "  Service installed successfully!"
echo "========================================"
echo ""
echo "Commands:"
echo "  sudo systemctl start $SERVICE_NAME    # Start service"
echo "  sudo systemctl stop $SERVICE_NAME     # Stop service"
echo "  sudo systemctl status $SERVICE_NAME   # Check status"
echo "  sudo journalctl -u $SERVICE_NAME -f   # View logs"
echo ""
echo "Note: Make sure environment variables (bot tokens) are available."
echo "You may need to create: ~/.config/environment.d/telegram.conf"
echo "Example:"
echo "  PICHU_BOT_TOKEN=your_token_here"
echo "  PIKACHU_BOT_TOKEN=your_token_here"
echo "  ..."
