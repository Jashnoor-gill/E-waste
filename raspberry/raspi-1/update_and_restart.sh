#!/usr/bin/env bash
set -euo pipefail
# update_and_restart.sh — pull latest changes and restart systemd service (if used)
BASEDIR="$(cd "$(dirname "$0")" && pwd)"
cd "$BASEDIR"

echo "Pulling latest changes..."
git pull origin main

echo "Reinstalling python deps into venv (if requirements.txt changed)..."
if [ -d .venv ]; then
  .venv/bin/pip install -r requirements.txt || true
fi

echo "Restarting service if available..."
if command -v systemctl >/dev/null 2>&1; then
  sudo systemctl restart raspi-client.service || true
fi

echo "Done."
