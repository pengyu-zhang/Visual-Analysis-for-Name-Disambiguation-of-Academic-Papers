#!/usr/bin/env bash
# One-click entry point: regenerate the demo data, run the smoke test,
# then serve the app on http://localhost:8000/.
# Usage: bash scripts/run_all.sh [PORT]
set -euo pipefail
cd "$(dirname "$0")"

bash prepare_data.sh
bash smoke_test.sh
bash serve.sh "${1:-8000}"
