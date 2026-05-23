#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SERVICE_SRC="$SCRIPT_DIR/ig-dashboard.service"
SERVICE_DST="/etc/systemd/system/ig-dashboard.service"
CURRENT_USER=$(whoami)

echo "=== IG Dashboard — Linux (systemd) Setup ==="
echo "Project: $PROJECT_DIR"
echo "User: $CURRENT_USER"

# Check node
NODE_PATH=$(which node 2>/dev/null)
if [ -z "$NODE_PATH" ]; then
  echo "Error: node not found. Install Node.js 20+ first."
  exit 1
fi
echo "Node: $NODE_PATH"

# Check .env
if [ ! -f "$PROJECT_DIR/.env" ]; then
  echo "Warning: .env not found. Copy .env.example and fill in your credentials."
fi

# Generate service file
sudo sed -e "s|__PROJECT_DIR__|$PROJECT_DIR|g" \
         -e "s|__USER__|$CURRENT_USER|g" \
         -e "s|/usr/bin/node|$NODE_PATH|g" \
         "$SERVICE_SRC" > /tmp/ig-dashboard.service
sudo mv /tmp/ig-dashboard.service "$SERVICE_DST"

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable ig-dashboard
sudo systemctl start ig-dashboard

echo ""
echo "✅ Dashboard service installed!"
echo "   URL: http://localhost:3000"
echo ""
echo "   Status:  sudo systemctl status ig-dashboard"
echo "   Logs:    sudo journalctl -u ig-dashboard -f"
echo "   Stop:    sudo systemctl stop ig-dashboard"
echo "   Remove:  sudo systemctl disable ig-dashboard && sudo rm $SERVICE_DST"
