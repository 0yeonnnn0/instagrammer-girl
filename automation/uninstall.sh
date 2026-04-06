#!/bin/bash
set -e

PLIST_DST="$HOME/Library/LaunchAgents/ig-cardnews.plist"

echo "=== Uninstalling Card News Scheduler ==="

if [ -f "$PLIST_DST" ]; then
  launchctl unload "$PLIST_DST" 2>/dev/null || true
  rm -f "$PLIST_DST"
  echo "Schedule removed."
else
  echo "No schedule found (already uninstalled)."
fi

echo "Done."
