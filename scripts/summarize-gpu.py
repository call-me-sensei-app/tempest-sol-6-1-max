import json
from pathlib import Path
root=Path(__file__).resolve().parent.parent;p=root/'artifacts/benchmarks'
labels={9:'Cinematic TSL baseline',11:'Skip zero-contribution dielectric SSR rays; allocation-free normals',12:'Shared GPU cloud optical-depth light cache',13:'16-bit wave display; 32-bit FFT retained',14:'2×2 world-space cloud-light amortization',15:'Typed, phase-cached spectral buoyancy',16:'Freeze nonmoving world transforms',17:'Reuse FFT quad and camera across butterfly stages',18:'Cache shadow-light traversal',19:'Pre-bit-reverse spectrum and conjugate inputs'}
rows=[];best=None;streak=0
for f in sorted(p.glob('gpu-opt-[0-9][0-9].json')):
 locked=p/'locked'/f.name;r=json.loads((locked if locked.exists() else f).read_text());quality=[]
 for view in ['hero','whale','cabin','rope','water','helm','rig','tail','eyes']:
  q=p/f'quality-{r["id"]}-{view}.json'
  if q.exists():quality.append(json.loads(q.read_text()))
 baseline=r['id']=='gpu-opt-00'
 light=r.get('cloudLightingAudit')
 passed=r.get('graphicsValid',False) and (r.get('spectrumAudit') or {}).get('pass',False) and (light is None or light.get('pass',False)) and (baseline or len(quality)==9 and all(q['pass'] for q in quality))
 mean=r['frame']['mean'];gain=0 if best is None else (best-mean)/best*100
 if best is not None:streak=streak+1 if passed and gain<5 else 0
 if passed and (best is None or mean<best):best=mean
 worst=max((max(q['wholeScene']['ssimLossPercent'],q['bottleAndInstruments']['ssimLossPercent']) for q in quality),default=0)
 description=labels.get(r['optimizationLevel'],r['id'])
 if r['id']=='gpu-opt-04':description='Low-resolution 2×2 cloud-light cache — rejected by RMS audit'
 if r['id']=='gpu-opt-05':description='Refined optical-depth cache: 256×64×128, 2×2 amortization'
 rows.append({'id':r['id'],'level':r['optimizationLevel'],'description':description,'meanMs':mean,'medianMs':r['frame']['median'],'p95Ms':r['frame']['p95'],'fps':r.get('completedFPS',1000/mean),'cpuMs':r['cpu']['mean'],'gpuMs':r['gpu']['mean'] if r['gpu'] else None,'calls':r['drawCalls']['mean'],'triangles':r['triangles']['mean'],'gainVsIncumbentPercent':gain,'streak':streak,'qualityPassed':passed,'worstSsimLossPercent':worst,'record':r})
result={'rows':rows,'plateauMet':streak>=5,'streak':streak,'comparison':'Mean overall accepted-frame interval versus the fastest prior quality-accepted incumbent. Slower candidates have negative improvement; failed fidelity resets the streak and cannot become the incumbent. Five consecutive accepted iterations below 5% satisfy the stop criterion.','notes':['Fixed 1280×720 / DPR1, Cinematic, 100% tempest, 150 warmup + 360 measured frames. Two-frame GPU queue cap and completion fences on every frame.','Nine deterministic views must have SSIM >.99 and RGB mean error <1%, both whole-scene and detail region. Only benchmark UI is masked.','No render resolution, MSAA, authored geometry, texture resolution, spectral modes, cloud primary ray steps or shadow-map resolution are reduced between candidates. Cloud-light caching is accepted only with the image gate.','GPU elapsed is measured by timestamp markers across the complete frame, not sums of overlapping passes. CPU submission and GPU elapsed overlap and are not additive.','Measurements are observational on a shared Apple M4 Pro / 20-core GPU laptop; thermal state, scheduling and other applications can introduce variance. A plateau does not prove a global optimum.','Diagnostic disabled-feature runs and pre-migration/invalid-timing experiments are excluded from acceptance and retained separately.']}
(root/'artifacts/final-optimization.json').write_text(json.dumps(result,indent=2)+'\n')
for x in rows:print(f"{x['id']}: {x['meanMs']:.3f}ms, {x['fps']:.1f} completed FPS, CPU {x['cpuMs']:.2f}, GPU {x['gpuMs'] if x['gpuMs'] else 'unavailable'}, gain {x['gainVsIncumbentPercent']:+.2f}%, streak {x['streak']}, quality {x['qualityPassed']}, worst SSIM loss {x['worstSsimLossPercent']:.3f}%")
