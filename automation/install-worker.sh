#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PLIST_SRC="$SCRIPT_DIR/ig-worker.plist"
PLIST_DST="$HOME/Library/LaunchAgents/ig-worker.plist"

echo "=== IG Worker Auto-Start Setup ==="
echo "Project: $PROJECT_DIR"

NODE_PATH=$(which node 2>/dev/null || echo "/usr/local/bin/node")
if [ ! -f "$NODE_PATH" ]; then
  echo "Error: node not found. Install Node.js first."
  exit 1
fi
echo "Node: $NODE_PATH"
NODE_BIN_DIR="$(dirname "$NODE_PATH")"

mkdir -p "$PROJECT_DIR/logs"

ENV_FILE="$PROJECT_DIR/.env"
if [ -f "$ENV_FILE" ]; then
  ENCRYPTION_KEY=$(grep '^ENCRYPTION_KEY=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- || echo "")
  SESSION_SECRET=$(grep '^SESSION_SECRET=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- || echo "")
  ADMIN_USERNAME=$(grep '^ADMIN_USERNAME=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- || echo "admin")
  ADMIN_PASSWORD=$(grep '^ADMIN_PASSWORD=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- || echo "admin")
  AI_PROVIDER=$(grep '^AI_PROVIDER=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- || echo "codex")
  AI_MODEL=$(grep '^AI_MODEL=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- || echo "gpt-5.4")
  PUPPETEER_EXECUTABLE_PATH=$(grep '^PUPPETEER_EXECUTABLE_PATH=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- || echo "")
else
  ENCRYPTION_KEY=""
  SESSION_SECRET=""
  ADMIN_USERNAME="admin"
  ADMIN_PASSWORD="admin"
  AI_PROVIDER="codex"
  AI_MODEL="gpt-5.4"
  PUPPETEER_EXECUTABLE_PATH=""
fi

if launchctl list | grep -q ig-worker 2>/dev/null; then
  echo "Unloading existing worker..."
  launchctl unload "$PLIST_DST" 2>/dev/null || true
fi

sed -e "s|__PROJECT_DIR__|$PROJECT_DIR|g" \
    -e "s|__HOME__|$HOME|g" \
    -e "s|/usr/local/bin/node|$NODE_PATH|g" \
    -e "s|__NODE_BIN_DIR__|$NODE_BIN_DIR|g" \
    -e "s|__ENCRYPTION_KEY__|$ENCRYPTION_KEY|g" \
    -e "s|__SESSION_SECRET__|$SESSION_SECRET|g" \
    -e "s|__ADMIN_USERNAME__|$ADMIN_USERNAME|g" \
    -e "s|__ADMIN_PASSWORD__|$ADMIN_PASSWORD|g" \
    -e "s|__AI_PROVIDER__|$AI_PROVIDER|g" \
    -e "s|__AI_MODEL__|$AI_MODEL|g" \
    -e "s|__PUPPETEER_EXECUTABLE_PATH__|$PUPPETEER_EXECUTABLE_PATH|g" \
    "$PLIST_SRC" > "$PLIST_DST"

launchctl load "$PLIST_DST"

echo ""
echo "✅ Worker service installed!"
echo "   Plist:  $PLIST_DST"
echo "   Verify: launchctl list | grep ig-worker"
echo "   Logs:   tail -f $PROJECT_DIR/logs/worker-stdout.log"
echo "   Stop:   launchctl unload $PLIST_DST"
