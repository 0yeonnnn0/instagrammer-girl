#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PLIST_SRC="$SCRIPT_DIR/ig-cardnews.plist"
PLIST_DST="$HOME/Library/LaunchAgents/ig-cardnews.plist"

echo "=== Instagram Card News Scheduler ==="
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

# Unload existing if present
if launchctl list | grep -q ig-cardnews 2>/dev/null; then
  echo "Unloading existing schedule..."
  launchctl unload "$PLIST_DST" 2>/dev/null || true
fi

# Generate plist with actual paths
sed -e "s|__PROJECT_DIR__|$PROJECT_DIR|g" \
    -e "s|__HOME__|$HOME|g" \
    -e "s|/usr/local/bin/node|$NODE_PATH|g" \
    "$PLIST_SRC" > "$PLIST_DST"

# Load
launchctl load "$PLIST_DST"

echo ""
echo "Schedule installed. Card news will generate daily at 07:00."
echo "Plist: $PLIST_DST"
echo ""
echo "Verify: launchctl list | grep cardnews"
echo "Test:   npm run daily:dry-run"
