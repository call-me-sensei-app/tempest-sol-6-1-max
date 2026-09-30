import argparse,json,time
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('id');p.add_argument('--after',type=float,default=0);a=p.parse_args();f=Path('artifacts/benchmarks')/(a.id+'.json')
for _ in range(240):
 if f.exists() and f.stat().st_mtime>a.after:
  r=json.loads(f.read_text());print(json.dumps({k:r.get(k) for k in ['id','at','graphicsValid','frame','cpu','physics','gpu','gpuSamples','completedFPS','spectrumAudit']},indent=2));break
 time.sleep(1)
else:raise SystemExit('Benchmark did not complete within four minutes')
