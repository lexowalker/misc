#!/usr/bin/env bash
# Start RefDAW and open it in the browser.
set -euo pipefail
cd "$(dirname "$0")"
[ -x .venv/bin/python ] || { echo "Run ./setup.sh first"; exit 1; }
PORT="${REFDAW_PORT:-8765}"
( sleep 2; command -v open >/dev/null && open "http://localhost:$PORT" || true ) &
REFDAW_PORT="$PORT" exec .venv/bin/python -m server.app
