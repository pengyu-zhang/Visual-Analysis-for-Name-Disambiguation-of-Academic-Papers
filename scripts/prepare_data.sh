#!/usr/bin/env bash
# Regenerate the bundled demo dataset (data/demo_papers.csv).
# Deterministic: running it twice produces identical output.
# Usage: bash scripts/prepare_data.sh
set -euo pipefail
cd "$(dirname "$0")/.."

PY="${PYTHON:-python3}"
command -v "$PY" >/dev/null 2>&1 || PY=python

"$PY" scripts/generate_demo_data.py
