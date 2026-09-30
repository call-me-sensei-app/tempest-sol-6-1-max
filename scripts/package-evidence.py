from pathlib import Path
import json,zipfile,shutil
ROOT=Path(__file__).resolve().parent.parent
for name in ['screenshot-accounting.json','final-optimization.json','accounting.json','verification.json']:
 p=ROOT/'artifacts'/name
 if p.exists():shutil.copy2(p,ROOT/'public'/name)
with zipfile.ZipFile(ROOT/'public/benchmark-evidence.zip','w',zipfile.ZIP_DEFLATED) as z:
 z.writestr('READ-ME.txt','Use artifacts/final-optimization.json and immutable artifacts/benchmarks/locked/ for the formal optimization sequence. Same-id JSON outside locked/ can reflect later hot reloads and is retained as preliminary evidence, not the acceptance measurement. Cross-backend parity and repeat/ablation runs are separate from the five-iteration plateau. Screenshot accounting records original save times and the latest logged usage snapshot available then. No private conversation contents are included.\n')
 for p in (ROOT/'artifacts/benchmarks').rglob('*'):
  if p.is_file() and (p.name.startswith(('gpu-opt-','quality-gpu-opt-','verify-','diag-','parity-'))):z.write(p,p.relative_to(ROOT))
 for p in (ROOT/'artifacts/verification').glob('*'):
  if p.is_file():z.write(p,p.relative_to(ROOT))
 for p in (ROOT/'progress').glob('*'):
  if p.is_file():z.write(p,p.relative_to(ROOT))
 for name in ['final-optimization.json','accounting.json','screenshot-accounting.json','verification.json']:
  p=ROOT/'artifacts'/name
  if p.exists():z.write(p,p.relative_to(ROOT))
print('Packaged locked benchmarks, comparison metrics, screenshot originals and accounting.')
