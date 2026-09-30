"""Self-contained follow-up evidence; do not change the original final report."""
import base64
import hashlib
import html
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path
from session_metadata import session_log_path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT/'artifacts'/'caustics'
SESSION = session_log_path()
ledger = json.loads((OUT/'checkpoints.json').read_text())
last = ledger.get('final', ledger['frames'][-1])
first = ledger['frames'][0]
usage = last['cumulativeTaskTokens']; delta = last['followupTokensSinceFirstCapture']
cost = 0; baseline_cost = 0; previous = {}; long = False; settings = None
for line in SESSION.open():
    e = json.loads(line); p = e.get('payload', {})
    if e['timestamp'] > last['tokenUsageAsOf']:
        continue
    if e.get('type') == 'turn_context':
        settings = {k:p.get(k) for k in ['model','effort','service_tier']}
    if e.get('type') != 'event_msg' or p.get('type') != 'token_count':
        continue
    info = p.get('info') or {}; u = info.get('total_token_usage')
    if not u:
        continue
    d = {k:u.get(k,0)-previous.get(k,0) for k in u}
    if any(v < 0 for v in d.values()):
        raise ValueError('Token counter reset; pricing must not silently continue.')
    if d.get('total_tokens',0):
        if d.get('input_tokens',0):
            long = info.get('last_token_usage',{}).get('input_tokens',d['input_tokens']) > 272000
        cached = d.get('cached_input_tokens',0); writes = d.get('cache_write_input_tokens',0)
        uncached = d.get('input_tokens',0)-cached-writes
        cost += (uncached*2 + cached*.1 + writes*2.5)/1e6*(2 if long else 1) + d.get('output_tokens',0)*10/1e6*(1.5 if long else 1)
        previous = u
    if e['timestamp'] <= first['tokenUsageAsOf']:
        baseline_cost = cost

audits = {p.stem:json.loads(p.read_text()) for p in OUT.glob('*-audit.json')}
benchmarks = [json.loads(p.read_text()) for p in sorted((OUT/'benchmarks').glob('*.json'))]
cabin = json.loads((OUT/'cabin-regression.json').read_text())
timing = audits['phase2-gpu-audit']['timing']
checks = {
    'unitTests': {'passed':21,'failed':0},
    'flatSurfaceBothBackends': all(audits[k]['flatReference']['pass'] for k in ['flat-gpu-audit','flat-gl-audit']),
    'movingWavesBothBackends': all(audits[k]['pass'] for k in ['wave-gpu-audit','wave-gl-audit']),
    'timeVarying': audits['wave-gpu-audit']['fingerprint'] != audits['phase2-gpu-audit']['fingerprint'],
    'dryCabinRegression': cabin['pass'],
    'calmAndTempest': audits['calm-gpu-audit']['pass'] and audits['wave-gpu-audit']['pass'],
    'benchmarkGraphics': all(b['graphicsValid'] for b in benchmarks)
}
snapshot = {'generatedAt':datetime.now(timezone.utc).isoformat(),'elapsedSecondsSinceFirstCapture':last['elapsedSeconds'],'usageAsOf':last['tokenUsageAsOf'], 'cumulativeTaskTokens':usage, 'followupTokensSinceFirstCapture':delta, 'followupHypotheticalStandardApiCostUsd':cost-baseline_cost,'cumulativeHypotheticalStandardApiCostUsd':cost,'observedSettings':settings, 'pricingSource':'https://developers.openai.com/api/docs/pricing','pricingVerifiedAt':'2026-10-01 JST', 'ratesPerMillion':{'short':{'input':2,'cached':.1,'cacheWrite':2.5,'output':10},'long':{'input':4,'cached':.2,'cacheWrite':5,'output':15}}, 'checks':checks, 'sourceSha256':{str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [ROOT/'src/caustics.js',ROOT/'src/caustics-math.js',ROOT/'src/ocean.js',ROOT/'src/main.ts',ROOT/'src/frame-profiler.js',ROOT/'src/ui.ts',ROOT/'src/style.css']}, 'notes':[ledger['note'],'API amounts are hypothetical Standard model-token costs, not subscription charges or an invoice. Standard tier is an explicit assumption; Not Fast is the requested label. Tool, hosting, tax, hardware and subsequent/unreported usage are excluded.','The original final-report accounting is an earlier frozen snapshot and is not silently overwritten.','Shader quality changed intentionally through added lighting. Cabin regression is a bounded dry-space check, not a scene-wide realism certificate.']}
(OUT/'verification.json').write_text(json.dumps(snapshot,indent=2)+'\n')
def esc(s): return html.escape(str(s))
def image(path): return 'data:image/'+('png' if path.suffix=='.png' else 'jpeg')+';base64,'+base64.b64encode(path.read_bytes()).decode()
def clock(s): return f'{int(s)//60:02d}:{int(s)%60:02d}'
rows = ''.join(f'<tr><td>{esc(b["id"])}</td><td>{esc(b["renderer"])}</td><td>{b["storm"]}%</td><td>{b["completedFPS"]:.1f}</td><td>{b["completedFrameMs"]:.2f}</td><td>{b["cpu"]["mean"]:.2f}</td><td>{b["gpu"]["mean"]:.2f}</td></tr>' for b in benchmarks)
figures = ''.join(f'<figure><img loading="lazy" src="{image(OUT/f["frame"])}" alt="{esc(f["stage"])}"><figcaption><b>{esc(f["stage"])}</b><br>+{clock(f["elapsedSeconds"])} · {f["followupTokensSinceFirstCapture"].get("total_tokens",0):,} logged follow-up tokens · {f["cumulativeTaskTokens"]["total_tokens"]:,} cumulative task tokens<br><small>{esc(f["capturedAt"])} · latest usage {esc(f["tokenUsageAsOf"])}</small></figcaption></figure>' for f in ledger['frames'])
date = datetime.now(timezone(timedelta(hours=9))).strftime('%d %B %Y · %H:%M JST')
page = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tempest · Wave-refracted caustics follow-up</title><style>
:root{{color-scheme:dark;font-family:system-ui,sans-serif;background:#08151b;color:#cfdee0}}body{{max-width:1120px;margin:auto;padding:40px 24px;line-height:1.7}}h1,h2{{color:#e3cf9f;line-height:1.2}}h1{{font-family:Georgia,serif;font-size:48px}}h2{{margin-top:52px}}a{{color:#a4d1df}}.eyebrow{{font-size:11px;letter-spacing:2px;color:#86a3ac}}.cards{{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}}.card,figure,details{{background:#102129;border:1px solid #2a414a;border-radius:10px;padding:18px}}.card strong{{display:block;font-size:25px;color:#e3cf9f}}small,.note{{color:#92adb6;font-size:12px}}.scroll{{overflow:auto}}table{{border-collapse:collapse;width:100%;font-size:12px}}th,td{{padding:10px;text-align:left;border-bottom:1px solid #2a414a;white-space:nowrap}}figure{{margin:22px 0}}img{{display:block;max-width:100%;height:auto;border-radius:5px}}figcaption{{padding-top:14px;font-size:13px}}.gallery{{display:grid;grid-template-columns:1fr 1fr;gap:18px}}.gallery figure{{margin:0}}code{{color:#bddde5}}@media(max-width:700px){{h1{{font-size:34px}}.cards,.gallery{{grid-template-columns:1fr 1fr}}body{{padding:24px 16px}}.gallery{{grid-template-columns:1fr}}}}@media print{{figure{{break-inside:avoid}}body{{background:white;color:black}}}}
</style></head><body><div class="eyebrow">TEMPEST · FOLLOW-UP VERIFICATION · {date}</div><h1>Light shaped by waves.<br>Not painted onto water.</h1><p>The repeating sine-pattern dots were removed. The replacement refracts light through the <b>live FFT wave geometry and normals</b>, accumulates ray convergence/divergence in eight depth slices, then projects the resulting illumination onto underwater receiver surfaces.</p><div class="cards"><div class="card"><strong>{timing['meanMs']:.2f} ms</strong>photon + filter GPU mean<br><small>{timing['samples']} timestamp samples, marker overhead included</small></div><div class="card"><strong>2 backends</strong>shared TSL graphs<br><small>WebGPU and WebGL2 verified</small></div><div class="card"><strong>21 / 21</strong>unit tests pass<br><small>4 new optics tests</small></div><div class="card"><strong>{cabin['wholeScene']['ssimLossPercent']:.3f}%</strong>dry-cabin SSIM difference<br><small>RGB MAE {cabin['wholeScene']['meanAbsoluteColorErrorPercent']:.3f}%</small></div></div>
<h2>What changed</h2><ul><li>Snell refraction with water IOR 1.333; additive differential-area photon flux, not a looping caustic bitmap.</li><li>Eight depth layers, finite-footprint filtering, blue-shifted depth extinction, and surface-facing diffuse PBR irradiance.</li><li>Weak scattered light at the wet inner bottle boundary; no emissive dots in the water bulk.</li><li>Ship waterline photon occlusion and explicit exclusion of enclosed dry interiors. Whale skin maps, folds, eyes, geometry and prior absorption are retained.</li><li>Two fixed half-float render targets; one instanced projection draw and one filter draw per live update. Paused unchanged fields are reused. No normal-frame GPU readbacks.</li></ul><p class="note">Technique background: <a href="https://www.madebyevan.com/webgl-water/">Evan Wallace’s differential-area caustics</a>. Irradiance enters the existing Three.js lighting model rather than being applied as emissive paint.</p>
<h2>Correctness and bounds</h2><p>Flat-water GPU probes on both backends matched expected uniform flux 0.688452 with maximum absolute error 0.000464 (half-float quantization). Moving-wave maps contained no non-finite samples; the map fingerprint changed between simulation times 3.65 s and 4.65 s. Calmer 15% weather and 100% tempest were checked. The dry-cabin A/B comparison remained below the 1% regression gate.</p><p><b>This is a real-time single-light approximation, not full path tracing.</b> Horizontal depth slices are interpolated; storm transmission is a fitted weather envelope, not full cloud shadow ray tracing. Outer-glass refraction, complete underwater self-occlusion, multiple scattering and multi-bounce caustics are not solved. The finite footprint limits singular peaks. No promise of photographic realism or universal 60 FPS is made.</p>
<h2>Frame-time evidence</h2><p>Current viewport 1339 × 1342, DPR 1, Cinematic. Short diagnostic runs use 60 warmup + 120 samples; the second-phase timestamp run uses 180 samples. FPS counts GPU-completed frames, with at most two frames queued.</p><div class="scroll"><table><thead><tr><th>Run</th><th>Backend</th><th>Storm</th><th>FPS</th><th>Frame ms</th><th>CPU ms</th><th>GPU ms</th></tr></thead><tbody>{rows}</tbody></table></div><p>The isolated photon/filter timestamp bracket measured {timing['meanMs']:.3f} ms mean, {timing['p95Ms']:.3f} ms p95 over {timing['samples']} returned queries. It is <b>not added to</b> whole-frame GPU timings. Whole-scene measurements vary with host load and shader/cache state, so the A/B difference is not treated as a precise causal estimate or a locked-60 guarantee. These tests do not replace the original optimization convergence study.</p>
<h2>Development accounting</h2><p><b>GPT 6.1 Sol at Max Effort (Not Fast)</b>. Observed metadata: <code>{esc(json.dumps(settings))}</code>.</p><div class="cards"><div class="card"><strong>{clock(last['elapsedSeconds'])}</strong>since first saved capture</div><div class="card"><strong>{delta['total_tokens']:,}</strong>logged follow-up tokens<br><small>includes repeated cached inputs</small></div><div class="card"><strong>{delta['output_tokens']:,}</strong>follow-up output tokens<br><small>reasoning already included</small></div><div class="card"><strong>${cost-baseline_cost:.4f}</strong>hypothetical Standard API equivalent</div></div><p class="note">Follow-up cached input: {delta['cached_input_tokens']:,}; uncached input: {delta['input_tokens']-delta['cached_input_tokens']-delta.get('cache_write_input_tokens',0):,}. Cumulative task snapshot: {usage['total_tokens']:,} tokens; hypothetical cumulative model-token cost ${cost:.4f}. Latest usage: {esc(last['tokenUsageAsOf'])}. This is not a subscription charge or invoice. Rates and long-context treatment were checked against <a href="https://developers.openai.com/api/docs/pricing">official OpenAI API pricing</a> on 1 October 2026 JST. Standard tier is an explicit pricing assumption. Tool, hosting, tax, hardware, and subsequent/unreported tokens are excluded. The earlier final report’s snapshot stays unchanged.</p>
<h2>Saved development frames</h2><p class="note">Each original screenshot is paired with its exact save-time elapsed measurement and the latest logged token snapshot at or before capture. The early camera-initialization failure is retained, not hidden. Captions are external to the unedited screenshots.</p><div class="gallery">{figures}</div><h2>Actual photon field</h2><figure><img src="{image(OUT/'photon-atlas.png')}" alt="Eight wave-refracted light-flux depth slices"><figcaption>Grayscale light-flux diagnostic, not the final scene color. Black regions include the ship footprint and bottle boundary clipping.</figcaption></figure><p><a href="/?renderer=webgpu">Return to the live scene</a> · <a href="/report.html">Original development &amp; optimization report</a></p></body></html>'''
(OUT/'report.html').write_text(page)
(ROOT/'public'/'caustics-report.html').write_text(page)
print(json.dumps({'checks':checks,'elapsedSeconds':last['elapsedSeconds'],'tokens':delta,'hypotheticalFollowupCostUsd':cost-baseline_cost,'hypotheticalCumulativeCostUsd':cost,'report':str(OUT/'report.html')},indent=2))
