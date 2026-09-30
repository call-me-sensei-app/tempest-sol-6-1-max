import json
from pathlib import Path
root=Path(__file__).resolve().parent.parent
p=root/'artifacts'/'benchmarks'
files=[p/'spectral-baseline.json']+sorted(p.glob('spectral-[0-9][0-9].json'))
names=['Unoptimized spectral baseline','Shadow/capture reuse','Static material batching','Reflection memoization + static matrices','Allocation-free spectral buoyancy','Typed-array cloth/whale normals','Throttled DOM diagnostics','Reused diagnostics object','Static texture matrices','Row-wise whale displacement','Allocation-free normal accumulation']
rows=[];best=None;streak=0
for i,f in enumerate(files):
 r=json.loads(f.read_text());mean=r['frame']['mean'];improvement=0 if best is None else (best-mean)/best*100
 quality=[]
 for view in ['hero','whale','cabin','rope','water']:
  q=p/f'quality-{r["id"]}-{view}.json'
  if q.exists():quality.append(json.loads(q.read_text()))
 passes=all(q['pass'] for q in quality) and len(quality)==5
 if best is not None:streak=streak+1 if improvement<5 else 0
 if best is None or (mean<best and passes):best=mean
 rows.append({'id':r['id'],'description':names[i] if i<len(names) else r['id'],'meanMs':mean,'medianMs':r['frame']['median'],'p95Ms':r['frame']['p95'],'fps':1000/mean,'cpuMs':r['cpu']['mean'],'gpuMs':r['gpu']['mean'] if r['gpu'] else None,'drawCalls':r['drawCalls']['mean'],'triangles':r['triangles']['mean'],'improvementVsIncumbentPercent':improvement,'consecutiveSub5Percent':streak,'qualityPassed':passes,'worstSsimLossPercent':max((q['bottleAndInstruments']['ssimLossPercent'] for q in quality),default=None),'raw':f.name,'record':r})
result={'rows':rows,'stoppingCriterionMet':streak>=5,'consecutiveSub5Percent':streak,'definition':'Mean measured overall rAF frame time versus the fastest prior quality-accepted candidate; slower candidates count as no improvement. Each iteration is a distinct cumulative code optimization. Five successive sub-5% candidates meet the requested plateau rule.','limitations':['Browser, OS and concurrently open demo introduce variance. Differences are observations, not isolated statistically proven causal effects.','CPU submission and GPU elapsed times overlap. GPU timer can include contention with other GPU clients; do not add them or force them to equal the rAF period.','Screenshot thresholds are regression gates, not proof of photographic realism or universal <1% perceptual loss.']}
(root/'artifacts'/'optimization-results.json').write_text(json.dumps(result,indent=2)+'\n')
for r in rows:print(f"{r['id']:20} {r['meanMs']:6.2f} ms {r['fps']:5.1f} FPS CPU {r['cpuMs']:5.2f} GPU {r['gpuMs']:6.2f} delta {r['improvementVsIncumbentPercent']:6.2f}% streak {r['consecutiveSub5Percent']} quality {r['qualityPassed']}")
