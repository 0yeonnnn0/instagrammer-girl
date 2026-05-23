#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PLIST_SRC="$SCRIPT_DIR/ig-dashboard.plist"
PLIST_DST="$HOME/Library/LaunchAgents/ig-dashboard.plist"

echo "=== IG Dashboard Auto-Start Setup ==="
echo "Project: $PROJECT_DIR"

# Find node path
NODE_PATH=$(which node 2>/dev/null || echo "/usr/local/bin/node")
if [ ! -f "$NODE_PATH" ]; then
  echo "Error: node not found. Install Node.js first."
  exit 1
fi
echo "Node: $NODE_PATH"

# Create logs directory
mkdir -p "$PROJECT_DIR/logs"

# Read .env for dashboard secrets
ENV_FILE="$PROJECT_DIR/.env"
if [ -f "$ENV_FILE" ]; then
  ENCRYPTION_KEY=$(grep ENCRYPTION_KEY "$ENV_FILE" 2>/dev/null | cut -d= -f2- || echo "change-me-32chars")
  SESSION_SECRET=$(grep SESSION_SECRET "$ENV_FILE" 2>/dev/null | cut -d= -f2- || echo "change-me-32chars")
  ADMIN_USERNAME=$(grep ADMIN_USERNAME "$ENV_FILE" 2>/dev/null | cut -d= -f2- || echo "admin")
  ADMIN_PASSWORD=$(grep ADMIN_PASSWORD "$ENV_FILE" 2>/dev/null | cut -d= -f2- || echo "admin")
else
  ENCRYPTION_KEY="change-me-32chars"
  SESSION_SECRET="change-me-32chars"
  ADMIN_USERNAME="admin"
  ADMIN_PASSWORD="admin"
fi

# Unload existing if present
if launchctl list | grep -q ig-dashboard 2>/dev/null; then
  echo "Unloading existing service..."
  launchctl unload "$PLIST_DST" 2>/dev/null || true
fi

# Generate plist with actual paths
sed -e "s|__PROJECT_DIR__|$PROJECT_DIR|g" \
    -e "s|__HOME__|$HOME|g" \
    -e "s|/usr/local/bin/node|$NODE_PATH|g" \
    -e "s|__ENCRYPTION_KEY__|$ENCRYPTION_KEY|g" \
    -e "s|__SESSION_SECRET__|$SESSION_SECRET|g" \
    -e "s|__ADMIN_USERNAME__|$ADMIN_USERNAME|g" \
    -e "s|__ADMIN_PASSWORD__|$ADMIN_PASSWORD|g" \
    "$PLIST_SRC" > "$PLIST_DST"

# Load
launchctl load "$PLIST_DST"

echo ""
echo "✅ Dashboard service installed!"
echo "   URL: http://localhost:3000"
echo "   Plist: $PLIST_DST"
echo ""
echo "   Verify: launchctl list | grep ig-dashboard"
echo "   Logs:   tail -f $PROJECT_DIR/logs/dashboard-stdout.log"
echo "   Stop:   launchctl unload $PLIST_DST"
