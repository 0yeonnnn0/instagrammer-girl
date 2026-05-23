#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SERVICE_SRC="$SCRIPT_DIR/ig-worker.service"
SERVICE_DST="/etc/systemd/system/ig-worker.service"
CURRENT_USER=$(whoami)

echo "=== IG Worker — Linux (systemd) Setup ==="
echo "Project: $PROJECT_DIR"
echo "User: $CURRENT_USER"

NODE_PATH=$(which node 2>/dev/null)
if [ -z "$NODE_PATH" ]; then
  echo "Error: node not found. Install Node.js 20+ first."
  exit 1
fi
echo "Node: $NODE_PATH"

if [ ! -f "$PROJECT_DIR/.env" ]; then
  echo "Error: .env not found. Copy .env.example and fill in your credentials."
  exit 1
fi

sudo sed -e "s|__PROJECT_DIR__|$PROJECT_DIR|g" \
         -e "s|__USER__|$CURRENT_USER|g" \
         -e "s|/usr/bin/node|$NODE_PATH|g" \
         "$SERVICE_SRC" > /tmp/ig-worker.service
sudo mv /tmp/ig-worker.service "$SERVICE_DST"

sudo systemctl daemon-reload
sudo systemctl enable ig-worker
sudo systemctl restart ig-worker

echo ""
echo "✅ Worker service installed!"
echo "   Status:  sudo systemctl status ig-worker"
echo "   Logs:    sudo journalctl -u ig-worker -f"
echo "   Stop:    sudo systemctl stop ig-worker"
echo "   Remove:  sudo systemctl disable ig-worker && sudo rm $SERVICE_DST"
