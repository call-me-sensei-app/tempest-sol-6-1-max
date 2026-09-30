import json
from pathlib import Path
root=Path(__file__).resolve().parent.parent;p=root/'artifacts'/'benchmarks'
labels=['Baseline','Shadow and exterior capture reuse','Static geometry batching','Reflection reuse, collision broadphase, cached cloud envelope, static matrices and light culling','Allocation-free spectral buoyancy','Typed-array deforming-mesh normals','DOM diagnostic throttling','Diagnostics object reuse','Static texture matrices','Row-wise whale displacement','Allocation-free normal accumulation']
rows=[];best=None;streak=0
for f in sorted(p.glob('verified-[0-9][0-9].json')):
 r=json.loads(f.read_text());level=r['optimizationLevel'];quality=[]
 for view in ['hero','whale','cabin','rope','water','helm','rig','tail','eyes']:
  q=p/f'quality-{r["id"]}-{view}.json'
  if q.exists():quality.append(json.loads(q.read_text()))
 passed=level==0 or len(quality)==9 and all(q['pass'] for q in quality)
 mean=r['frame']['mean'];gain=0 if best is None else (best-mean)/best*100
 if best is not None:streak=streak+1 if gain<5 else 0
 if passed and (best is None or mean<best):best=mean
 worst=max((max(q['wholeScene']['ssimLossPercent'],q['bottleAndInstruments']['ssimLossPercent']) for q in quality),default=0)
 rows.append({'id':r['id'],'level':level,'description':labels[level] if level<len(labels) else r['id'],'meanMs':mean,'medianMs':r['frame']['median'],'p95Ms':r['frame']['p95'],'fps':1000/mean,'cpuMs':r['cpu']['mean'],'gpuMs':r['gpu']['mean'] if r['gpu'] else None,'calls':r['drawCalls']['mean'],'triangles':r['triangles']['mean'],'gainVsIncumbentPercent':gain,'streak':streak,'qualityPassed':passed,'worstSsimLossPercent':worst,'record':r})
result={'rows':rows,'plateauMet':streak>=5,'streak':streak,'comparison':'Overall rAF mean frame time versus fastest prior quality-accepted incumbent. A slower candidate is a negative improvement. This definition prevents noise-driven regressions from becoming the new target.','notes':['Fixed 1280×720 / DPR1, High, 100% tempest; 150 warmup + 360 measured frames. Dynamic field and geometry are identical between candidates.','Nine deterministic screenshot views must have SSIM >=.99 and RGB mean error <1%, including their object detail region; only benchmark UI excluded.','GPU query measures asynchronous elapsed work and may include other-client contention. CPU and GPU are not additive. Small timing changes are observational, not proven causality.','Third-party rendering demo was no longer open for this final series. Preliminary contended runs and pre-visual-fix results are retained separately and excluded from the conclusion.']}
(root/'artifacts'/'final-optimization.json').write_text(json.dumps(result,indent=2)+'\n')
for x in rows:print(f"{x['id']}: {x['meanMs']:.3f} ms, {x['fps']:.1f} FPS, CPU {x['cpuMs']:.2f}, GPU {x['gpuMs']:.2f}, gain {x['gainVsIncumbentPercent']:+.2f}%, streak {x['streak']}, quality {x['qualityPassed']}")
