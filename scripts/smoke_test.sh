#!/usr/bin/env bash
# Smoke test: verifies that (1) the demo-data generator is deterministic
# and matches the committed CSV, and (2) every asset the app needs is
# served correctly over HTTP. Finishes in well under a minute.
# Usage: bash scripts/smoke_test.sh [PORT]
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${1:-8765}"
PY="${PYTHON:-python3}"
command -v "$PY" >/dev/null 2>&1 || PY=python

echo "== 1/3 data pipeline determinism =="
TMP_CSV="$("$PY" -c 'import tempfile,os; fd,p=tempfile.mkstemp(suffix=".csv"); os.close(fd); print(p)')"
trap 'rm -f "$TMP_CSV"' EXIT
"$PY" scripts/generate_demo_data.py --out "$TMP_CSV" >/dev/null
if "$PY" - "$TMP_CSV" data/demo_papers.csv <<'EOF'
import sys
a, b = (open(p, encoding="utf-8").read().replace("\r\n", "\n") for p in sys.argv[1:3])
sys.exit(0 if a == b else 1)
EOF
then
  echo "OK: generator output matches committed data/demo_papers.csv"
else
  echo "FAIL: generator output differs from committed data/demo_papers.csv" >&2
  exit 1
fi

echo "== 2/3 start HTTP server =="
"$PY" -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SERVER_PID=$!
trap 'rm -f "$TMP_CSV"; kill "$SERVER_PID" 2>/dev/null || true' EXIT
sleep 1

echo "== 3/3 check served assets =="
ASSETS="
index.html
css/style.css
js/config.js
js/i18n.js
js/csv.js
js/colors.js
js/pipeline.js
js/state.js
js/query.js
js/dumbbell.js
js/network.js
js/sankey.js
js/yearbars.js
js/wordcloud.js
js/radar.js
js/tabs.js
js/analysis.js
js/app.js
vendor/d3.v7.min.js
vendor/d3-sankey.min.js
vendor/d3.layout.cloud.js
data/demo_papers.csv
"
FAIL=0
for asset in $ASSETS; do
  code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT}/${asset}")"
  if [ "$code" = "200" ]; then
    echo "  200 ${asset}"
  else
    echo "  ${code} ${asset}  <-- FAIL" >&2
    FAIL=1
  fi
done

[ "$FAIL" = "0" ] && echo "SMOKE TEST PASSED" || { echo "SMOKE TEST FAILED" >&2; exit 1; }
