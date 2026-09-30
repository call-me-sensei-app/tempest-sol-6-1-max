#!/bin/sh
set -eu
PY="${PYTHON_BIN:-python3}"
ID="$1"
for view in hero whale cabin rope water; do
 "$PY" scripts/compare-quality.py "artifacts/benchmarks/spectral-baseline-$view.jpg" "artifacts/benchmarks/$ID-$view.jpg" --out "artifacts/benchmarks/quality-$ID-$view.json" >/dev/null
done
python3 scripts/summarize-benchmarks.py
