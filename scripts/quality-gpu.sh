#!/bin/sh
set -eu
PY="${PYTHON_BIN:-python3}"
ID="$1"
for view in hero whale cabin rope water helm rig tail eyes; do
 "$PY" scripts/compare-quality.py "artifacts/benchmarks/gpu-opt-00-$view.jpg" "artifacts/benchmarks/$ID-$view.jpg" --out "artifacts/benchmarks/quality-$ID-$view.json" >/dev/null
done
python3 scripts/summarize-gpu.py
