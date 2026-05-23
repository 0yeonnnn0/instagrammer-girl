#!/bin/bash
set -e

PLIST_DST="$HOME/Library/LaunchAgents/ig-worker.plist"

echo "=== Uninstalling Worker Scheduler ==="

if [ -f "$PLIST_DST" ]; then
  launchctl unload "$PLIST_DST" 2>/dev/null || true
  rm -f "$PLIST_DST"
  echo "Worker schedule removed."
else
  echo "No worker schedule found."
fi

echo "Done."
