#!/usr/bin/env bash
# Serve the visualization app over HTTP (any static server works).
# Usage: bash scripts/serve.sh [PORT]
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${1:-8000}"
PY="${PYTHON:-python3}"
command -v "$PY" >/dev/null 2>&1 || PY=python

echo "Serving http://localhost:${PORT}/ (Ctrl+C to stop)"
exec "$PY" -m http.server "$PORT" --bind 127.0.0.1
