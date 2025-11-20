#!/usr/bin/env bash
set -euo pipefail
# run.sh — start pi client from this folder's venv
BASEDIR="$(cd "$(dirname "$0")" && pwd)"
cd "$BASEDIR"

# If venv doesn't exist, create it
if [ ! -d ".venv" ]; then
  python3 -m venv .venv
  .venv/bin/pip install --upgrade pip
  if [ -f requirements.txt ]; then
    .venv/bin/pip install -r requirements.txt
  fi
fi

# Activate venv and run
. .venv/bin/activate

# Default server can be overridden by --server or env SERVER_URL
SERVER_URL=${SERVER_URL:-https://e-waste-backend-3qxc.onrender.com}
NAME=${NAME:-raspi-1}

exec .venv/bin/python pi_client.py --server "$SERVER_URL" --name "$NAME"
